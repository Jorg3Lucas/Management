/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // O nginx/proxy repassa o host interno (resistancemir4.online:3000), então o
      // Next compara a Origin do browser (resistancemir4.online) com o host
      // encaminhado e aborta o POST das Server Actions como "Invalid Server Actions
      // request". Liberar os hosts públicos resolve sem depender do proxy.
      allowedOrigins: [
        "resistancemir4.online",
        "www.resistancemir4.online",
        "23.94.95.198",
      ],
    },
  },
};

export default nextConfig;
