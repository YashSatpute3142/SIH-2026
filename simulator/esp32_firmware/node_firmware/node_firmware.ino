#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <time.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* INGESTION_ENDPOINT = "http://YOUR_BACKEND_HOST:8000/api/sensor-readings";

const char* NODE_ID = "NODE-REAL-01";
const char* ZONE_ID = "A";
const char* DATA_SOURCE = "real";

const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 19800;
const int DAYLIGHT_OFFSET_SEC = 0;

#define TILT_X_PIN 34
#define TILT_Y_PIN 35
#define DISPLACEMENT_PIN 32
#define VIBRATION_PIN 33
#define CRACK_PIN 25
#define BATTERY_PIN 26
#define DHT_PIN 27
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long samplingIntervalMs = 60000;
unsigned long sequenceNumber = 0;
unsigned long totalSendAttempts = 0;
unsigned long failedSendAttempts = 0;

float previousDisplacementMM = 0.0;
String calibrationStatus = "factory_default";

void connectToWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
}

void ensureWiFiConnected() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
}

String getReadingTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "1970-01-01 00:00:00";
  }
  char buffer[32];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buffer);
}

float analogToRange(int rawValue, float minOutput, float maxOutput) {
  float ratio = rawValue / 4095.0;
  return minOutput + ratio * (maxOutput - minOutput);
}

bool isAnalogReadingSuspect(int rawValue) {
  return rawValue <= 5 || rawValue >= 4090;
}

float readTiltX() {
  int raw = analogRead(TILT_X_PIN);
  return round(analogToRange(raw, -1.0, 1.0) * 10000.0) / 10000.0;
}

float readTiltY() {
  int raw = analogRead(TILT_Y_PIN);
  return round(analogToRange(raw, -1.0, 1.0) * 10000.0) / 10000.0;
}

float readDisplacementMM() {
  int raw = analogRead(DISPLACEMENT_PIN);
  return round(analogToRange(raw, 0.0, 50.0) * 1000.0) / 1000.0;
}

void readVibrationMetrics(float &rmsOut, float &peakOut, float &varianceOut) {
  const int sampleCount = 60;
  float samples[sampleCount];
  float sumSquares = 0.0;
  float peak = 0.0;
  float mean = 0.0;

  for (int i = 0; i < sampleCount; i++) {
    int raw = analogRead(VIBRATION_PIN);
    float value = analogToRange(raw, 0.0, 2.0);
    samples[i] = value;
    mean += value;
    if (value > peak) {
      peak = value;
    }
    delayMicroseconds(500);
  }

  mean = mean / sampleCount;

  for (int i = 0; i < sampleCount; i++) {
    sumSquares += samples[i] * samples[i];
  }

  float variance = 0.0;
  for (int i = 0; i < sampleCount; i++) {
    float diff = samples[i] - mean;
    variance += diff * diff;
  }
  variance = variance / sampleCount;

  rmsOut = round(sqrt(sumSquares / sampleCount) * 10000.0) / 10000.0;
  peakOut = round(peak * 10000.0) / 10000.0;
  varianceOut = round(variance * 100000.0) / 100000.0;
}

float readCrackWidthMM() {
  int raw = analogRead(CRACK_PIN);
  return round(analogToRange(raw, 0.0, 10.0) * 1000.0) / 1000.0;
}

float readBatteryVoltage() {
  int raw = analogRead(BATTERY_PIN);
  float voltageAtPin = (raw / 4095.0) * 3.3;
  float actualVoltage = voltageAtPin * 2.0;
  return round(actualVoltage * 1000.0) / 1000.0;
}

String determineSensorStatus(bool anyPinSuspect, float batteryVoltage) {
  if (anyPinSuspect) {
    return "fault";
  }
  if (batteryVoltage < 3.3) {
    return "low_battery";
  }
  return "ok";
}

float currentPacketLossRatio() {
  if (totalSendAttempts == 0) {
    return 0.0;
  }
  return round(((float)failedSendAttempts / (float)totalSendAttempts) * 10000.0) / 10000.0;
}

void sendReading(StaticJsonDocument<640> &doc) {
  totalSendAttempts++;
  ensureWiFiConnected();

  if (WiFi.status() != WL_CONNECTED) {
    failedSendAttempts++;
    return;
  }

  HTTPClient http;
  http.begin(INGESTION_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  String payload;
  serializeJson(doc, payload);

  int responseCode = http.POST(payload);
  if (responseCode < 200 || responseCode >= 300) {
    failedSendAttempts++;
  }

  Serial.print("POST response code: ");
  Serial.println(responseCode);
  http.end();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  dht.begin();
  connectToWiFi();
}

void loop() {
  sequenceNumber++;

  int tiltXRaw = analogRead(TILT_X_PIN);
  int tiltYRaw = analogRead(TILT_Y_PIN);
  int displacementRaw = analogRead(DISPLACEMENT_PIN);
  int crackRaw = analogRead(CRACK_PIN);
  int batteryRaw = analogRead(BATTERY_PIN);

  bool anyPinSuspect =
      isAnalogReadingSuspect(tiltXRaw) ||
      isAnalogReadingSuspect(tiltYRaw) ||
      isAnalogReadingSuspect(displacementRaw) ||
      isAnalogReadingSuspect(crackRaw) ||
      isAnalogReadingSuspect(batteryRaw);

  float tiltX = readTiltX();
  float tiltY = readTiltY();
  float tiltMagnitude = round(sqrt(tiltX * tiltX + tiltY * tiltY) * 10000.0) / 10000.0;

  float displacementMM = readDisplacementMM();
  float displacementRate = round(
      ((displacementMM - previousDisplacementMM) / (samplingIntervalMs / 60000.0)) * 100000.0
  ) / 100000.0;
  previousDisplacementMM = displacementMM;

  float vibrationRms, vibrationPeak, vibrationVariance;
  readVibrationMetrics(vibrationRms, vibrationPeak, vibrationVariance);

  float crackWidthMM = readCrackWidthMM();
  bool crackDetected = crackWidthMM > 1.0;

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  bool dhtValid = !isnan(temperature) && !isnan(humidity);
  if (!dhtValid) {
    temperature = -999.0;
    humidity = -999.0;
  }

  float batteryVoltage = readBatteryVoltage();
  int rssi = WiFi.RSSI();
  float packetLoss = currentPacketLossRatio();

  String sensorStatus = determineSensorStatus(anyPinSuspect || !dhtValid, batteryVoltage);

  StaticJsonDocument<640> doc;
  doc["node_id"] = NODE_ID;
  doc["zone_id"] = ZONE_ID;
  doc["reading_timestamp"] = getReadingTimestamp();
  doc["sequence_number"] = sequenceNumber;
  doc["data_source"] = DATA_SOURCE;
  doc["tilt_x"] = tiltX;
  doc["tilt_y"] = tiltY;
  doc["tilt_magnitude"] = tiltMagnitude;
  doc["displacement_mm"] = displacementMM;
  doc["displacement_rate"] = displacementRate;
  doc["vibration_rms"] = vibrationRms;
  doc["vibration_peak"] = vibrationPeak;
  doc["vibration_variance"] = vibrationVariance;
  doc["crack_width_mm"] = crackWidthMM;
  doc["crack_detected"] = crackDetected;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["battery_voltage"] = batteryVoltage;
  doc["rssi"] = rssi;
  doc["packet_loss"] = packetLoss;
  doc["sensor_status"] = sensorStatus;
  doc["calibration_status"] = calibrationStatus;

  serializeJson(doc, Serial);
  Serial.println();

  sendReading(doc);

  delay(samplingIntervalMs);
}
