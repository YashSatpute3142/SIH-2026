import threading
from datetime import datetime, timezone

from scenarios import ScenarioSensorNode, SCENARIO_LIST
from network_sim import GatewaySimulator

NODE_CONFIG = [
    ("NODE-A-01", "A"),
    ("NODE-A-02", "A"),
    ("NODE-B-01", "B"),
    ("NODE-B-02", "B"),
    ("NODE-C-01", "C"),
    ("NODE-C-02", "C"),
    ("NODE-D-01", "D"),
]

SAMPLING_MAP = {
    "normal": 60,
    "gradual_deformation": 10,
    "sudden_deformation": 5,
    "crack_growth": 5,
    "vibration_only": 10,
    "sensor_failure": 10,
    "low_battery": 10,
    "comms_failure": 10,
    "internet_outage": 10,
    "recovery": 10,
}


class NodeRunner(threading.Thread):
    def __init__(self, node_id, zone_id, gateway, speed_factor):
        super().__init__(daemon=True)
        self.node = ScenarioSensorNode(
            node_id=node_id,
            zone_id=zone_id,
            data_source="simulated",
            scenario="normal",
            sampling_interval_seconds=SAMPLING_MAP["normal"],
        )
        self.gateway = gateway
        self.speed_factor = speed_factor
        self.stop_event = threading.Event()
        self.lock = threading.Lock()

    def set_scenario(self, scenario):
        with self.lock:
            self.node.set_scenario(scenario)
            self.node.sampling_interval_seconds = SAMPLING_MAP.get(scenario, 60)

    def set_speed_factor(self, speed_factor):
        with self.lock:
            self.speed_factor = speed_factor

    def status(self):
        with self.lock:
            return {
                "node_id": self.node.node_id,
                "zone_id": self.node.zone_id,
                "scenario": self.node.scenario,
                "sampling_interval_seconds": self.node.sampling_interval_seconds,
            }

    def stop(self):
        self.stop_event.set()

    def run(self):
        while not self.stop_event.is_set():
            with self.lock:
                interval = self.node.sampling_interval_seconds
                speed_factor = self.speed_factor
                reading = self.node.generate_reading()

            if reading is not None:
                reading["reading_timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

            self.gateway.relay(reading)
            sleep_time = max(0.1, interval / speed_factor)
            self.stop_event.wait(sleep_time)


def print_help():
    print("Commands:")
    print("  list                        show all node statuses")
    print("  set <node_id> <scenario>    set a node's scenario")
    print("  scenarios                   list valid scenario names")
    print("  internet on|off             toggle gateway internet status")
    print("  speed <factor>              scale sampling speed for testing (e.g. speed 10)")
    print("  help                        show this message")
    print("  stop                        stop all nodes and exit")


def main():
    speed_factor = 10.0
    gateway = GatewaySimulator(gateway_id="GATEWAY-1", log_path="network_output.log")
    runners = {}

    for node_id, zone_id in NODE_CONFIG:
        runner = NodeRunner(node_id, zone_id, gateway, speed_factor)
        runners[node_id] = runner
        runner.start()

    print("Simulation started with", len(runners), "nodes across zones A-D")
    print("Speed factor:", speed_factor, "(sampling intervals divided by this for testing)")
    print_help()

    while True:
        try:
            command = input("> ").strip()
        except EOFError:
            command = "stop"

        if not command:
            continue

        parts = command.split()
        action = parts[0].lower()

        if action == "list":
            for runner in runners.values():
                print(runner.status())

        elif action == "scenarios":
            print(SCENARIO_LIST)

        elif action == "set" and len(parts) == 3:
            node_id, scenario = parts[1], parts[2]
            if node_id not in runners:
                print("Unknown node_id:", node_id)
            elif scenario not in SCENARIO_LIST:
                print("Unknown scenario:", scenario)
            else:
                runners[node_id].set_scenario(scenario)
                print(node_id, "scenario set to", scenario)

        elif action == "internet" and len(parts) == 2:
            if parts[1].lower() == "on":
                gateway.set_internet_status(True)
            elif parts[1].lower() == "off":
                gateway.set_internet_status(False)
            else:
                print("Use: internet on|off")

        elif action == "speed" and len(parts) == 2:
            try:
                new_speed = float(parts[1])
                for runner in runners.values():
                    runner.set_speed_factor(new_speed)
                print("Speed factor set to", new_speed)
            except ValueError:
                print("Invalid speed factor")

        elif action == "help":
            print_help()

        elif action == "stop":
            print("Stopping all nodes...")
            for runner in runners.values():
                runner.stop()
            for runner in runners.values():
                runner.join(timeout=2)
            print("Stopped.")
            break

        else:
            print("Unknown command. Type 'help' for options.")


if __name__ == "__main__":
    main()
