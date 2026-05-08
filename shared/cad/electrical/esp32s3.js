// ESP32-S3 DevKitC-1 GPIO safety data.
// Avoids: strapping pins (0, 3, 45, 46), USB D+/D- (19, 20),
// SPI flash pins (26-32), octal-flash candidates (33-37).
// All other GPIO are treated as safe for matrix use.

export const ESP32S3 = {
  id: "esp32-s3-devkitc-1",
  name: "ESP32-S3 DevKitC-1",
  // Pin order is the auto-assignment order (rows first, then cols).
  SAFE_PINS: [
    1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    21, 38, 39, 40, 41, 42, 47, 48,
  ],
};

export const BOARDS = {
  [ESP32S3.id]: ESP32S3,
};
