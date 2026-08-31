import json
import random
import threading
import time
from datetime import datetime, timezone


class GatewaySimulator:
    def __init__(self, gateway_id="GATEWAY-1", lora_packet_loss_base=0.02,
                 lora_latency_range=(0.05, 0.3), log_path="network_output.log"):
        self.gateway_id = gateway_id
        self.lora_packet_loss_base = lora_packet_loss_base
        self.lora_latency_range = lora_latency_range
        self.log_path = log_path
        self.internet_online = True
        self.offline_queue = []
        self.lock = threading.Lock()

    def set_internet_status(self, online):
        with self.lock:
            was_offline = not self.internet_online
            self.internet_online = online
            self._log_event_unlocked({"event": "internet_status_change", "online": online,
                                       "queue_length": len(self.offline_queue)})
            if online and was_offline:
                self._flush_queue_unlocked()

    def _flush_queue_unlocked(self):
        flushed_count = 0
        while self.offline_queue:
            reading = self.offline_queue.pop(0)
            self._deliver_unlocked(reading, from_queue=True)
            flushed_count += 1
        self._log_event_unlocked({"event": "queue_flushed", "count": flushed_count})

    def _lora_hop(self, reading):
        extra_loss = reading.get("packet_loss", 0.0)
        combined_loss = min(0.95, self.lora_packet_loss_base + extra_loss)
        if random.random() < combined_loss:
            return None, None
        latency = round(random.uniform(*self.lora_latency_range), 3)
        return reading, latency

    def relay(self, reading):
        if reading is None:
            with self.lock:
                self._log_event_unlocked({"event": "dropped_at_node"})
            return None

        relayed_reading, latency = self._lora_hop(reading)
        if relayed_reading is None:
            with self.lock:
                self._log_event_unlocked({
                    "event": "dropped_at_lora",
                    "node_id": reading["node_id"],
                    "sequence_number": reading["sequence_number"],
                })
            return None

        relayed_reading = dict(relayed_reading)
        relayed_reading["gateway_id"] = self.gateway_id
        relayed_reading["lora_latency_seconds"] = latency

        with self.lock:
            if self.internet_online:
                self._deliver_unlocked(relayed_reading, from_queue=False)
            else:
                self.offline_queue.append(relayed_reading)
                self._log_event_unlocked({
                    "event": "queued_offline",
                    "node_id": reading["node_id"],
                    "sequence_number": reading["sequence_number"],
                    "queue_length": len(self.offline_queue),
                })

        return relayed_reading

    def _deliver_unlocked(self, reading, from_queue):
        self._log_event_unlocked({
            "event": "delivered_from_queue" if from_queue else "delivered",
            "node_id": reading["node_id"],
            "sequence_number": reading["sequence_number"],
            "lora_latency_seconds": reading.get("lora_latency_seconds"),
        })
        print("DELIVERED:", reading)

    def _log_event_unlocked(self, event):
        event["timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        event["gateway_id"] = self.gateway_id
        print(event)
        with open(self.log_path, "a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(event) + "\n")


if __name__ == "__main__":
    from scenarios import ScenarioSensorNode

    gateway = GatewaySimulator(gateway_id="GATEWAY-1", log_path="network_output.log")
    node = ScenarioSensorNode(node_id="NODE-A-01", zone_id="A", scenario="normal",
                               sampling_interval_seconds=2)

    print("Phase 1: internet online, normal scenario")
    for _ in range(4):
        reading = node.generate_reading()
        if reading is not None:
            reading["reading_timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        gateway.relay(reading)
        time.sleep(1)

    print("Phase 2: internet goes offline")
    gateway.set_internet_status(False)
    for _ in range(4):
        reading = node.generate_reading()
        if reading is not None:
            reading["reading_timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        gateway.relay(reading)
        time.sleep(1)

    print("Phase 3: internet comes back, queue should flush")
    gateway.set_internet_status(True)
