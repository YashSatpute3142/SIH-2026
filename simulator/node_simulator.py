import random
import time
from datetime import datetime, timezone


class SensorNode:
    def __init__(self, node_id, zone_id, data_source="simulated", sampling_interval_seconds=60):
        self.node_id = node_id
        self.zone_id = zone_id
        self.data_source = data_source
        self.sampling_interval_seconds = sampling_interval_seconds
        self.sequence_number = 0

        self.tilt_x = round(random.uniform(-0.05, 0.05), 4)
        self.tilt_y = round(random.uniform(-0.05, 0.05), 4)
        self.displacement_mm = round(random.uniform(0.0, 0.5), 3)
        self.crack_width_mm = round(random.uniform(0.0, 0.2), 3)
        self.battery_voltage = round(random.uniform(3.9, 4.2), 2)
        self.temperature = round(random.uniform(22.0, 28.0), 1)
        self.humidity = round(random.uniform(40.0, 60.0), 1)
        self.rssi = random.randint(-70, -40)
        self.sensor_status = "ok"
        self.calibration_status = "calibrated"

    def _drift(self, value, magnitude, min_value=None, max_value=None):
        new_value = value + random.uniform(-magnitude, magnitude)
        if min_value is not None:
            new_value = max(min_value, new_value)
        if max_value is not None:
            new_value = min(max_value, new_value)
        return round(new_value, 4)

    def generate_reading(self):
        self.sequence_number += 1

        self.tilt_x = self._drift(self.tilt_x, 0.01, -0.5, 0.5)
        self.tilt_y = self._drift(self.tilt_y, 0.01, -0.5, 0.5)
        tilt_magnitude = round((self.tilt_x ** 2 + self.tilt_y ** 2) ** 0.5, 4)

        previous_displacement = self.displacement_mm
        self.displacement_mm = self._drift(self.displacement_mm, 0.02, 0.0, 5.0)
        displacement_rate = round(
            (self.displacement_mm - previous_displacement) / (self.sampling_interval_seconds / 60.0), 5
        )

        vibration_rms = round(random.uniform(0.01, 0.08), 4)
        vibration_peak = round(vibration_rms + random.uniform(0.01, 0.05), 4)
        vibration_variance = round(random.uniform(0.0001, 0.001), 5)

        self.crack_width_mm = self._drift(self.crack_width_mm, 0.005, 0.0, 3.0)
        crack_detected = self.crack_width_mm > 1.0

        self.temperature = self._drift(self.temperature, 0.3, 15.0, 40.0)
        self.humidity = self._drift(self.humidity, 1.0, 20.0, 90.0)

        self.battery_voltage = self._drift(self.battery_voltage, 0.005, 3.0, 4.2)
        self.rssi = max(-100, min(-30, self.rssi + random.randint(-2, 2)))
        packet_loss = round(random.uniform(0.0, 0.02), 4)

        reading = {
            "node_id": self.node_id,
            "zone_id": self.zone_id,
            "reading_timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "sequence_number": self.sequence_number,
            "data_source": self.data_source,
            "tilt_x": self.tilt_x,
            "tilt_y": self.tilt_y,
            "tilt_magnitude": tilt_magnitude,
            "displacement_mm": self.displacement_mm,
            "displacement_rate": displacement_rate,
            "vibration_rms": vibration_rms,
            "vibration_peak": vibration_peak,
            "vibration_variance": vibration_variance,
            "crack_width_mm": self.crack_width_mm,
            "crack_detected": crack_detected,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "battery_voltage": self.battery_voltage,
            "rssi": self.rssi,
            "packet_loss": packet_loss,
            "sensor_status": self.sensor_status,
            "calibration_status": self.calibration_status,
        }

        return reading


if __name__ == "__main__":
    node = SensorNode(node_id="NODE-A-01", zone_id="A", data_source="simulated", sampling_interval_seconds=5)

    for _ in range(5):
        reading = node.generate_reading()
        print(reading)
        time.sleep(1)
