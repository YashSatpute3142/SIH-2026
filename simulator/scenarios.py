import random
from node_simulator import SensorNode

SCENARIO_LIST = [
    "normal",
    "gradual_deformation",
    "sudden_deformation",
    "crack_growth",
    "vibration_only",
    "sensor_failure",
    "low_battery",
    "comms_failure",
    "internet_outage",
    "recovery",
]


class ScenarioSensorNode(SensorNode):
    def __init__(self, node_id, zone_id, data_source="simulated", sampling_interval_seconds=60, scenario="normal"):
        super().__init__(node_id, zone_id, data_source, sampling_interval_seconds)
        self.scenario = scenario
        self.scenario_tick = 0
        self.sudden_jump_tick = random.randint(5, 10)

    def set_scenario(self, scenario):
        self.scenario = scenario
        self.scenario_tick = 0
        self.sudden_jump_tick = random.randint(5, 10)

    def _get_profile(self):
        if self.scenario == "gradual_deformation":
            return dict(tilt_drift=0.02, displacement_drift=0.03, displacement_bias=0.06,
                        vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.0, 0.02), sensor_status_override=None,
                        calibration_status_override=None, dropout_probability=0.0)
        if self.scenario == "sudden_deformation":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.05, 0.2), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.0, 0.02), sensor_status_override=None,
                        calibration_status_override=None, dropout_probability=0.0)
        if self.scenario == "crack_growth":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.01, 0.08), crack_drift=0.06, battery_drain=0.005,
                        packet_loss_range=(0.0, 0.02), sensor_status_override=None,
                        calibration_status_override=None, dropout_probability=0.0)
        if self.scenario == "vibration_only":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.4, 0.9), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.0, 0.02), sensor_status_override=None,
                        calibration_status_override=None, dropout_probability=0.0)
        if self.scenario == "sensor_failure":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.2, 0.5), sensor_status_override="fault",
                        calibration_status_override="uncalibrated", dropout_probability=0.5)
        if self.scenario == "low_battery":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.05,
                        packet_loss_range=(0.0, 0.05), sensor_status_override=None,
                        calibration_status_override=None, dropout_probability=0.0)
        if self.scenario == "comms_failure":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.4, 0.9), sensor_status_override="ok",
                        calibration_status_override=None, dropout_probability=0.6)
        if self.scenario == "internet_outage":
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.0, 0.02), sensor_status_override=None,
                        calibration_status_override=None, dropout_probability=0.0)
        if self.scenario == "recovery":
            decay = max(0.0, 0.5 - (self.scenario_tick * 0.05))
            status = "recovering" if decay > 0.05 else "ok"
            return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                        vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.005,
                        packet_loss_range=(0.0, max(0.02, decay)), sensor_status_override=status,
                        calibration_status_override=None, dropout_probability=decay * 0.3)
        return dict(tilt_drift=0.01, displacement_drift=0.02, displacement_bias=0.0,
                    vibration_range=(0.01, 0.08), crack_drift=0.005, battery_drain=0.005,
                    packet_loss_range=(0.0, 0.02), sensor_status_override=None,
                    calibration_status_override=None, dropout_probability=0.0)

    def generate_reading(self):
        self.sequence_number += 1
        self.scenario_tick += 1
        profile = self._get_profile()

        if random.random() < profile["dropout_probability"]:
            return None

        self.tilt_x = self._drift(self.tilt_x, profile["tilt_drift"], -1.0, 1.0)
        self.tilt_y = self._drift(self.tilt_y, profile["tilt_drift"], -1.0, 1.0)
        tilt_magnitude = round((self.tilt_x ** 2 + self.tilt_y ** 2) ** 0.5, 4)

        previous_displacement = self.displacement_mm
        if self.scenario == "sudden_deformation" and self.scenario_tick == self.sudden_jump_tick:
            self.displacement_mm = round(self.displacement_mm + random.uniform(40.0, 55.0), 4)
        else:
            biased_value = self.displacement_mm + profile["displacement_bias"]
            self.displacement_mm = self._drift(biased_value, profile["displacement_drift"], 0.0, 50.0)
        displacement_rate = round(
            (self.displacement_mm - previous_displacement) / (self.sampling_interval_seconds / 60.0), 5
        )

        vib_low, vib_high = profile["vibration_range"]
        vibration_rms = round(random.uniform(vib_low, vib_high), 4)
        vibration_peak = round(vibration_rms + random.uniform(0.01, 0.05), 4)
        vibration_variance = round(random.uniform(0.0001, 0.002), 5)

        self.crack_width_mm = self._drift(self.crack_width_mm, profile["crack_drift"], 0.0, 10.0)
        crack_detected = self.crack_width_mm > 1.0

        self.temperature = self._drift(self.temperature, 0.3, 15.0, 40.0)
        self.humidity = self._drift(self.humidity, 1.0, 20.0, 90.0)

        self.battery_voltage = round(
            max(3.0, self.battery_voltage - profile["battery_drain"] - random.uniform(0.0, 0.002)), 3
        )

        self.rssi = max(-100, min(-30, self.rssi + random.randint(-2, 2)))
        p_low, p_high = profile["packet_loss_range"]
        packet_loss = round(random.uniform(p_low, p_high), 4)

        sensor_status = profile["sensor_status_override"]
        if sensor_status is None:
            sensor_status = "low_battery" if self.battery_voltage < 3.3 else "ok"
        self.sensor_status = sensor_status

        if profile["calibration_status_override"] is not None:
            self.calibration_status = profile["calibration_status_override"]
        else:
            self.calibration_status = "calibrated"

        return {
            "node_id": self.node_id,
            "zone_id": self.zone_id,
            "reading_timestamp": None,
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


if __name__ == "__main__":
    from datetime import datetime, timezone

    for scenario_name in SCENARIO_LIST:
        node = ScenarioSensorNode(node_id="NODE-A-01", zone_id="A", scenario=scenario_name,
                                   sampling_interval_seconds=5)
        print("SCENARIO:", scenario_name)
        for _ in range(8):
            reading = node.generate_reading()
            if reading is None:
                print("  DROPPED PACKET")
                continue
            reading["reading_timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            print(" ", reading)
        print()
