"use client";

import React, { useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, PhoneOff, Mic, MicOff, Sparkles, CircleDot, X } from "lucide-react";

interface ActiveCallRow {
  id: string;
  externalCallId: string;
  direction: string;
  status: string;
  fromPhone: string;
  toPhone: string;
  callerName: string;
  offerSdp: string;
  answerSdp: string;
}

function playRingToneOnce() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [440, 480].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // ignore autoplay restriction
  }
}

async function waitForIceGathering(pc: RTCPeerConnection, maxMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, maxMs);
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

export function WhatsAppSoftphone() {
  const [incomingCall, setIncomingCall] = useState<ActiveCallRow | null>(null);
  const [liveCall, setLiveCall] = useState<ActiveCallRow | null>(null);
  const [callState, setCallState] = useState<"IDLE" | "RINGING_IN" | "DIALING" | "CONNECTED" | "SUMMARIZING">("IDLE");
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [statusNotice, setStatusNotice] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastRungIdRef = useRef<string>("");
  const remoteAppliedRef = useRef<boolean>(false);

  const cleanupMedia = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    recorderRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteAppliedRef.current = false;
    setMuted(false);
    setRecording(false);
  };

  // Timer during active connected call
  useEffect(() => {
    if (callState !== "CONNECTED") {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  // Poll every 3s for incoming WhatsApp calls OR remote SDP answer for outbound call
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/voip/whatsapp?activeOnly=1");
        if (!res.ok) return;
        const d = await res.json();
        const list: ActiveCallRow[] = d.activeCalls || [];

        // 1. Outbound dialing: wait for Meta webhook to save answerSdp
        if (callState === "DIALING" && liveCall) {
          const updated = list.find((c) => c.id === liveCall.id);
          if (updated && updated.answerSdp && pcRef.current && !remoteAppliedRef.current) {
            remoteAppliedRef.current = true;
            await pcRef.current.setRemoteDescription({ type: "answer", sdp: updated.answerSdp });
            setLiveCall(updated);
            setCallState("CONNECTED");
            setStatusNotice("🎙️ Conectado vía WhatsApp WebRTC");
          }
          return;
        }

        // 2. Inbound ringing call
        if (callState === "IDLE") {
          const ringingIn = list.find((c) => c.direction === "INBOUND" && c.status === "RINGING");
          if (ringingIn) {
            setIncomingCall(ringingIn);
            setCallState("RINGING_IN");
            if (lastRungIdRef.current !== ringingIn.id) {
              lastRungIdRef.current = ringingIn.id;
              playRingToneOnce();
            }
          }
        } else if (callState === "RINGING_IN" && incomingCall) {
          const stillRinging = list.find((c) => c.id === incomingCall.id && c.status === "RINGING");
          if (!stillRinging) {
            setIncomingCall(null);
            setCallState("IDLE");
          }
        }
      } catch {
        // silent background poll
      }
    };
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [callState, liveCall, incomingCall]);

  // Global event listener so /bandeja and /clientes buttons can initiate outbound WhatsApp calls
  useEffect(() => {
    const onStartOutbound = async (ev: Event) => {
      const detail = (ev as CustomEvent<{ to: string; callerName?: string; clientId?: string }>).detail;
      if (!detail?.to) return;
      await startOutboundCall(detail.to, detail.callerName || detail.to, detail.clientId);
    };
    window.addEventListener("impulsa:start-wa-call", onStartOutbound);
    return () => window.removeEventListener("impulsa:start-wa-call", onStartOutbound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupPeerConnection = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setStatusNotice("Llamada finalizada.");
      }
    };

    return pc;
  };

  const startRecordingCall = () => {
    try {
      const chunks: Blob[] = [];
      recordedChunksRef.current = chunks;
      const tracks: MediaStreamTrack[] = [];
      if (localStreamRef.current) tracks.push(...localStreamRef.current.getAudioTracks());
      const remoteStream = remoteAudioRef.current?.srcObject as MediaStream | null;
      if (remoteStream) tracks.push(...remoteStream.getAudioTracks());
      if (tracks.length === 0) return;

      const combined = new MediaStream(tracks);
      const mr = MediaRecorder.isTypeSupported("audio/webm")
        ? new MediaRecorder(combined, { mimeType: "audio/webm" })
        : new MediaRecorder(combined);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.start(1000);
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      setStatusNotice("Tu navegador no permitió grabar el audio local.");
    }
  };

  const startOutboundCall = async (to: string, callerName: string, clientId?: string) => {
    try {
      setStatusNotice("Solicitando micrófono y conectando con WhatsApp...");
      setCallState("DIALING");
      const pc = await setupPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const finalSdp = pc.localDescription?.sdp || offer.sdp || "";
      const res = await fetch("/api/voip/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          to,
          callerName,
          clientId,
          sdp: finalSdp,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        cleanupMedia();
        setCallState("IDLE");
        setStatusNotice(`❌ ${d.error || "No se pudo iniciar la llamada. Asegúrate de tener permiso de llamada del cliente."}`);
        return;
      }
      setLiveCall(d.call);
      setStatusNotice(`📞 Llamando a ${callerName} por WhatsApp...`);
    } catch (err) {
      cleanupMedia();
      setCallState("IDLE");
      setStatusNotice(`❌ ${err instanceof Error ? err.message : "Permite acceso al micrófono para llamar."}`);
    }
  };

  const handleAcceptInbound = async () => {
    if (!incomingCall) return;
    try {
      setStatusNotice("Conectando audio WebRTC...");
      const pc = await setupPeerConnection();
      await pc.setRemoteDescription({ type: "offer", sdp: incomingCall.offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);

      const finalAnswer = pc.localDescription?.sdp || answer.sdp || "";
      const res = await fetch("/api/voip/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          callDbId: incomingCall.id,
          sdp: finalAnswer,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        cleanupMedia();
        setIncomingCall(null);
        setCallState("IDLE");
        setStatusNotice(`❌ ${d.error || "No se pudo contestar la llamada."}`);
        return;
      }
      setLiveCall(d.call);
      setIncomingCall(null);
      setCallState("CONNECTED");
      setStatusNotice("🎙️ En llamada VoIP gratuita de WhatsApp");
    } catch (err) {
      cleanupMedia();
      setCallState("IDLE");
      setStatusNotice(`❌ ${err instanceof Error ? err.message : "Error conectando micrófono."}`);
    }
  };

  const handleRejectInbound = async () => {
    if (!incomingCall) return;
    await fetch("/api/voip/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", callDbId: incomingCall.id }),
    }).catch(() => {});
    setIncomingCall(null);
    setCallState("IDLE");
  };

  const handleHangup = async () => {
    const activeId = liveCall?.id;
    const hadRecording = recording && recordedChunksRef.current.length > 0;
    const recordedBlob = hadRecording ? new Blob(recordedChunksRef.current, { type: "audio/webm" }) : null;
    recordedChunksRef.current = [];
    cleanupMedia();

    if (activeId) {
      await fetch("/api/voip/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "terminate", callDbId: activeId }),
      }).catch(() => {});
    }

    if (activeId && recordedBlob && recordedBlob.size > 1500) {
      setCallState("SUMMARIZING");
      setStatusNotice("🧠 Gemini transcribiendo y resumiendo la llamada en el historial del cliente...");
      try {
        const fd = new FormData();
        fd.append("callId", activeId);
        fd.append("audio", recordedBlob, "llamada-wa.webm");
        const r = await fetch("/api/voip/whatsapp", { method: "POST", body: fd });
        const d = await r.json();
        setStatusNotice(d.ok ? `✅ Resumen IA guardado: ${d.aiSummary}` : `⚠️ ${d.error || "No se pudo transcribir."}`);
      } catch {
        setStatusNotice("Llamada finalizada.");
      }
    }

    setLiveCall(null);
    setCallState("IDLE");
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  };

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Transient toast notice */}
      {statusNotice && callState === "IDLE" && (
        <div className="fixed bottom-24 left-5 z-50 max-w-sm bg-slate-900 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-2.5">
          <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{statusNotice}</div>
          <button
            type="button"
            onClick={() => setStatusNotice("")}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Incoming Call Modal Card */}
      {callState === "RINGING_IN" && incomingCall && (
        <div className="fixed bottom-6 left-6 z-50 w-80 bg-slate-950 text-white rounded-3xl p-5 shadow-2xl border-2 border-emerald-400 animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                📞 Llamada Entrante WhatsApp (Gratis)
              </div>
              <div className="font-black text-base truncate">{incomingCall.callerName}</div>
              <div className="text-xs text-slate-400">{incomingCall.fromPhone}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleAcceptInbound}
              className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" /> Contestar
            </button>
            <button
              type="button"
              onClick={handleRejectInbound}
              className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
            >
              <PhoneOff className="w-4 h-4" /> Rechazar
            </button>
          </div>
        </div>
      )}

      {/* Active / Dialing / Summarizing Softphone Bar */}
      {(callState === "DIALING" || callState === "CONNECTED" || callState === "SUMMARIZING") && (
        <div className="fixed bottom-6 left-6 z-50 w-80 bg-slate-950 text-white rounded-3xl p-4 shadow-2xl border border-indigo-400/50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                {callState === "DIALING"
                  ? "Marcando por WhatsApp..."
                  : callState === "SUMMARIZING"
                  ? "Resumiendo con Gemini IA..."
                  : `En llamada · ${formatTimer(seconds)}`}
              </div>
              <div className="font-black text-sm truncate">{liveCall?.callerName || "Cliente WhatsApp"}</div>
            </div>
            {callState === "SUMMARIZING" && <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />}
          </div>
          {statusNotice && <div className="text-[11px] text-slate-300">{statusNotice}</div>}
          {callState !== "SUMMARIZING" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                  muted ? "bg-amber-500 text-slate-950" : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {muted ? "Silenciado" : "Mic"}
              </button>
              <button
                type="button"
                disabled={recording || callState !== "CONNECTED"}
                onClick={startRecordingCall}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                  recording
                    ? "bg-rose-500/30 text-rose-200 border border-rose-400"
                    : "bg-white/10 hover:bg-white/20 text-white disabled:opacity-40"
                }`}
                title="Graba la llamada para que Gemini la transcriba y resuma al colgar"
              >
                <CircleDot className="w-3.5 h-3.5" />
                {recording ? "Grabando IA" : "Grabar IA"}
              </button>
              <button
                type="button"
                onClick={handleHangup}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1"
              >
                <PhoneOff className="w-4 h-4" /> Colgar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
