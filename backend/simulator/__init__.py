"""
MineShield demo/simulator package.

Drives the real backend end-to-end (ingestion -> feature engineering ->
rule engine -> ML inference -> alerts -> sync -> WebSocket broadcast) using
realistic sensor data. Contains NO risk/ML/alert logic of its own — the
real backend performs all of that, per project convention.
"""
