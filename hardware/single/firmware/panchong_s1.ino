/**
 * PanchongCAN-S1 — 单路 listen-only
 * Arduino-ESP32 3.x · 板：ESP32-C3-MINI-1
 *
 * 蓝牙名 PanchongCAN-S1，Nordic UART。
 * 连上后手机写 "listen"，按行上报：
 *   12.345 1826F456 01 01 00
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "driver/twai.h"

#define PIN_TWAI_TX 7
#define PIN_TWAI_RX 6
#define PIN_LED 10

static const char *BLE_NAME = "PanchongCAN-S1";
static const char *NUS_SVC = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *NUS_RX = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *NUS_TX = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

static BLECharacteristic *txChar = nullptr;
static volatile bool bleReady = false;
static volatile bool listening = false;
static bool twaiInstalled = false;
static uint32_t baud = 250000;
static uint32_t t0ms = 0;

static void led(bool on) { digitalWrite(PIN_LED, on ? LOW : HIGH); }

static void notifyChunked(const char *s) {
  if (!txChar || !bleReady) return;
  const int CHUNK = 20;
  int n = strlen(s);
  for (int i = 0; i < n; i += CHUNK) {
    int len = n - i;
    if (len > CHUNK) len = CHUNK;
    txChar->setValue((uint8_t *)(s + i), len);
    txChar->notify();
    delay(4);
  }
}

static void sendLine(const char *line) {
  notifyChunked(line);
}

static bool twaiStart(uint32_t bps) {
  if (twaiInstalled) {
    twai_stop();
    twai_driver_uninstall();
    twaiInstalled = false;
  }

  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(
      (gpio_num_t)PIN_TWAI_TX, (gpio_num_t)PIN_TWAI_RX, TWAI_MODE_LISTEN_ONLY);
  twai_timing_config_t t =
      (bps >= 500000) ? TWAI_TIMING_CONFIG_500KBITS() : TWAI_TIMING_CONFIG_250KBITS();
  twai_filter_config_t f = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  if (twai_driver_install(&g, &t, &f) != ESP_OK) return false;
  if (twai_start() != ESP_OK) {
    twai_driver_uninstall();
    return false;
  }
  twaiInstalled = true;
  return true;
}

static void handleCmd(String raw) {
  raw.trim();
  raw.replace("\r", "");
  if (!raw.length()) return;
  raw.toLowerCase();

  if (raw == "listen") {
    if (twaiStart(baud)) {
      listening = true;
      t0ms = millis();
      led(true);
      sendLine("# S1 listen-only\n");
    } else {
      sendLine("# twai fail\n");
    }
    return;
  }
  if (raw == "stop") {
    listening = false;
    twai_stop();
    led(false);
    sendLine("# stop\n");
    return;
  }
  if (raw == "info") {
    char buf[96];
    snprintf(buf, sizeof(buf), "# PanchongCAN-S1 baud=%lu listen=%d\n",
             (unsigned long)baud, listening ? 1 : 0);
    sendLine(buf);
    return;
  }
  if (raw.startsWith("baud")) {
    int sp = raw.indexOf(' ');
    uint32_t v = (sp > 0) ? (uint32_t)raw.substring(sp + 1).toInt() : 0;
    if (v == 500) v = 500000;
    if (v == 250) v = 250000;
    if (v == 250000 || v == 500000) {
      baud = v;
      if (listening) twaiStart(baud);
      sendLine("# baud ok\n");
    } else {
      sendLine("# baud 250|500\n");
    }
  }
}

class ServerCb : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { bleReady = true; }
  void onDisconnect(BLEServer *s) override {
    bleReady = false;
    listening = false;
    led(false);
    s->startAdvertising();
  }
};

class RxCb : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    String v = c->getValue();
    int from = 0;
    while (from < (int)v.length()) {
      int nl = v.indexOf('\n', from);
      if (nl < 0) {
        handleCmd(v.substring(from));
        break;
      }
      handleCmd(v.substring(from, nl));
      from = nl + 1;
    }
  }
};

void setup() {
  pinMode(PIN_LED, OUTPUT);
  led(false);

  BLEDevice::init(BLE_NAME);
  BLEServer *srv = BLEDevice::createServer();
  srv->setCallbacks(new ServerCb());
  BLEService *svc = srv->createService(NUS_SVC);

  txChar = svc->createCharacteristic(NUS_TX, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());

  BLECharacteristic *rx = svc->createCharacteristic(
      NUS_RX, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxCb());

  svc->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SVC);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
}

void loop() {
  if (!listening) {
    delay(20);
    return;
  }
  twai_message_t msg;
  if (twai_receive(&msg, pdMS_TO_TICKS(20)) != ESP_OK) return;
  if (msg.rtr) return;

  uint32_t id = msg.identifier;
  if (msg.extd) id &= 0x1FFFFFFF;
  else id &= 0x7FF;

  uint32_t dt = millis() - t0ms;
  char line[80];
  int n = snprintf(line, sizeof(line), "%lu.%03lu %08lX",
                   (unsigned long)(dt / 1000), (unsigned long)(dt % 1000),
                   (unsigned long)id);
  for (int i = 0; i < msg.data_length_code && i < 8; i++) {
    n += snprintf(line + n, sizeof(line) - n, " %02X", msg.data[i]);
  }
  n += snprintf(line + n, sizeof(line) - n, "\n");
  sendLine(line);
}
