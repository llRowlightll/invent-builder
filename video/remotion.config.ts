import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
// LinkedIn och de flesta spelare vill ha yuv420p.
Config.setPixelFormat("yuv420p");
