import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer", "@prisma/client", "prisma"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
