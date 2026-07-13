# Athhleticaa Band Pro - Backend Synchronization & JSON Schema Documentation

This document describes the API interface and JSON schemas for synchronizing Athhleticaa Band Pro user health metrics and workouts with the backend server.

---

## 1. Synchronization API Endpoints

All requests require the HTTP Header:
`Authorization: Bearer <user_token>`

### Upload Data (Bulk Sync)
* **URL**: `/bandpro/sync`
* **Method**: `POST`
* **Content-Type**: `application/json`
* **Request Body**:
```json
{
  "syncedAt": 1786524300000,
  "heartRate": [...],
  "pedometer": [...],
  "sleep": [...],
  "bloodOxygen": [...],
  "bloodGlucose": [...],
  "bloodComponents": [...],
  "bodyTemperature": [...],
  "hrv": [...],
  "stress": [...],
  "met": [...],
  "bloodPressure": [...],
  "bodyComposition": [...],
  "ecg": [...],
  "sportsWorkout": [...]
}
```
* **Response**: `200 OK` on successful synchronization.

### Download/Query Data
* **URL**: `/bandpro/query`
* **Method**: `GET`
* **Query Parameters**:
  - `date`: Date string in `yyyy-MM-dd` format (e.g. `2026-07-10`)
  - `type`: Data type to query. Valid types: `heartRate`, `pedometer`, `sleep`, `bloodOxygen`, `bloodGlucose`, `bloodComponents`, `bodyTemperature`, `hrv`, `stress`, `met`, `bloodPressure`, `bodyComposition`, `ecg`, `sportsWorkout`.
* **Response**: `200 OK` containing a list of JSON records matching the schema of the queried datatype.

---

## 2. JSON Schemas by Data Type

### 2.1 Heart Rate Samples
* **Local Table**: `persisted_heart_rate_samples`
* **Field Descriptions**:
  - `id`: unique record identifier (`{source}-{timestamp}`)
  - `heart_rate`: average heart rate (bpm)
  - `recorded_at`: epoch milliseconds timestamp
  - `heart_rates_json`: list of sub-samples
  - `source`: `"automatic"` or `"manual"`
* **Example JSON**:
```json
{
  "id": "automatic-1786524300000",
  "heart_rate": 72,
  "recorded_at": 1786524300000,
  "heart_rates_json": [70, 72, 75],
  "source": "automatic"
}
```

### 2.2 Pedometer/Activity Data
* **Local Table**: `persisted_pedometer_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds representing the start of the day
  - `total_steps`: total steps taken
  - `distance_meters`: distance traveled in meters
  - `calories_kcal`: active energy burned in kilocalories
  - `hourly_json`: hourly breakdown list
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "total_steps": 5420,
  "distance_meters": 3800,
  "calories_kcal": 210.5,
  "hourly_json": [{"hour":8,"steps":1200,"distanceMeters":800,"caloriesKcal":45.0,"timestamp":1786435200000}]
}
```

### 2.3 Sleep logs
* **Local Table**: `persisted_sleep_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds representing the start of the day
  - `sleep_json`: JSON containing sessions and stage-specific sleep durations.
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "sleep_json": {"date":"2026-07-10","sessions":[{"startTime":1786524300000,"endTime":1786553100000,"totalMinutes":480,"deepMinutes":120,"lightMinutes":300,"remMinutes":60,"awakeMinutes":0,"stageSegments":[{"startTime":1786524300000,"endTime":1786533100000,"stage":"light"}]}]}
}
```

### 2.4 Blood Oxygen (SPO2)
* **Local Table**: `persisted_blood_oxygen_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `blood_oxygen_json`: blood oxygen levels day details
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "blood_oxygen_json": {"date":"2026-07-10","average":98,"min":95,"max":100,"samples":[{"timestamp":1786524300000,"oxygen":98,"source":"automatic"}]}
}
```

### 2.5 Blood Glucose
* **Local Table**: `persisted_blood_glucose_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `blood_glucose_json`: glucose samples
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "blood_glucose_json": {"date":"2026-07-10","samples":[{"timestamp":1786524300000,"glucose":5.5}]}
}
```

### 2.6 Blood Components
* **Local Table**: `persisted_blood_components_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `blood_components_json`: blood properties (e.g. cholesterol, uric acid)
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "blood_components_json": {"date":"2026-07-10","samples":[{"timestamp":1786524300000,"uricAcid":350}]}
}
```

### 2.7 Body Temperature
* **Local Table**: `persisted_body_temperature_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `body_temperature_json`: skin temperature measurements
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "body_temperature_json": {"date":"2026-07-10","samples":[{"timestamp":1786524300000,"temperatureCelsius":36.6}]}
}
```

### 2.8 HRV (Heart Rate Variability)
* **Local Table**: `persisted_hrv_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `hrv_json`: HRV RMSSD/SDNN metrics
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "hrv_json": {"date":"2026-07-10","samples":[{"timestamp":1786524300000,"hrv":48}]}
}
```

### 2.9 Stress
* **Local Table**: `persisted_stress_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `stress_json`: stress levels details
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "stress_json": {"date":"2026-07-10","samples":[{"timestamp":1786524300000,"stress":35}]}
}
```

### 2.10 MET (Metabolic Equivalent of Task)
* **Local Table**: `persisted_met_days`
* **Field Descriptions**:
  - `id`: unique date string identifier (`yyyy-MM-dd`)
  - `date`: epoch milliseconds
  - `met_json`: MET metrics
* **Example JSON**:
```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "met_json": {"date":"2026-07-10","samples":[{"timestamp":1786524300000,"met":1.5}]}
}
```

### 2.11 Blood Pressure Samples
* **Local Table**: `persisted_blood_pressure_samples`
* **Field Descriptions**:
  - `id`: unique identifier (`{source}-{timestamp}`)
  - `systolic`: systolic value in mmHg
  - `diastolic`: diastolic value in mmHg
  - `recorded_at`: epoch milliseconds
  - `source`: `"automatic"` or `"manual"`
* **Example JSON**:
```json
{
  "id": "automatic-1786524300000",
  "systolic": 120,
  "diastolic": 80,
  "recorded_at": 1786524300000,
  "source": "automatic"
}
```

### 2.12 Body Composition Measurements
* **Local Table**: `persisted_body_composition_measurements`
* **Field Descriptions**:
  - `id`: unique identifier (usually based on timestamp)
  - `recorded_at`: epoch milliseconds
  - `is_device_test`: boolean mapping `0` or `1`
  - `stature`: height in cm
  - `weight`: weight in kg * 10 or raw int
  - `gender`: gender identification (int)
  - `bmi`: Body Mass Index
  - `body_fat_percentage`: fat percent
  - `fat_mass`: fat mass value
  - `lean_body_mass`: fat free mass
  - `muscle_rate`: muscle percentage
  - `muscle_mass`: muscle mass value
  - `subcutaneous_fat`: subcutaneous fat percent
  - `body_moisture`: moisture percentage
  - `water_content`: water content value
  - `skeletal_muscle_rate`: skeletal muscle rate
  - `bone_mass`: bone mass value
  - `proportion_of_protein`: protein percentage
  - `protein_amount`: protein amount
  - `basal_metabolic_rate`: BMR
  - `duration`: testing duration
  - `id_type`: ID identification type
* **Example JSON**:
```json
{
  "id": "1786524300000",
  "recorded_at": 1786524300000,
  "is_device_test": 1,
  "stature": 175,
  "weight": 70,
  "gender": 1,
  "bmi": 22.8,
  "body_fat_percentage": 15.4,
  "fat_mass": 10.78,
  "lean_body_mass": 59.22,
  "muscle_rate": 45.2,
  "muscle_mass": 31.64,
  "subcutaneous_fat": 11.2,
  "body_moisture": 60.1,
  "water_content": 42.07,
  "skeletal_muscle_rate": 35.8,
  "bone_mass": 3.1,
  "proportion_of_protein": 18.2,
  "protein_amount": 12.74,
  "basal_metabolic_rate": 1650.0,
  "duration": 15,
  "id_type": 1
}
```

### 2.13 ECG Measurements
* **Local Table**: `persisted_ecg_measurements`
* **Field Descriptions**:
  - `id`: unique measurement identifier
  - `recorded_at`: epoch milliseconds
  - `average_heart`: average heart rate (bpm)
  - `average_hrv`: average HRV value
  - `average_qt`: average QT duration
  - `average_pwv`: average pulse wave velocity
  - `duration_seconds`: measurement duration
  - `frequency`: sampling rate (Hz)
  - `draw_frequency`: display rendering frequency (Hz)
  - `lead_status`: lead connectivity check status
  - `success`: `0` or `1` for successful measurement
  - `data_type`: measurement data identifier
  - `ecg_type`: type of ECG channel / config
  - `waveform_json`: list of volt values
  - `raw_waveform_json`: raw digitized values
  - `heart_series_json`: timeseries heart rate
  - `hrv_series_json`: timeseries HRV
  - `rr_series_json`: timeseries RR intervals
  - `qt_series_json`: timeseries QT intervals
  - `pwv_series_json`: timeseries PWV
  - `qrs_duration_ms`: QRS duration
  - `qrs_amplitude_mv`: QRS amplitude
  - `qrs_direction`: upward/downward ECG deflection
  - `st_amplitude_mv`: ST elevation/depression
  - `sdnn`: SDNN index
  - `rmssd`: RMSSD index
* **Example JSON**:
```json
{
  "id": "1786524300000",
  "recorded_at": 1786524300000,
  "average_heart": 75,
  "average_hrv": 45,
  "average_qt": 380,
  "average_pwv": 1020,
  "duration_seconds": 30,
  "frequency": 512,
  "draw_frequency": 256,
  "lead_status": 1,
  "success": 1,
  "data_type": "ecg",
  "ecg_type": "standard",
  "waveform_json": [0.12, 0.15],
  "raw_waveform_json": [],
  "heart_series_json": [],
  "hrv_series_json": [],
  "rr_series_json": [],
  "qt_series_json": [],
  "pwv_series_json": [],
  "qrs_duration_ms": 85,
  "qrs_amplitude_mv": 1.2,
  "qrs_direction": "up",
  "st_amplitude_mv": 0.05,
  "sdnn": 48,
  "rmssd": 44
}
```

### 2.14 Sports Workouts
* **Local Table**: `persisted_sports_workouts`
* **Field Descriptions**:
  - `id`: unique record identifier
  - `mode_id`: workout mode identifier
  - `mode_title`: display title of workout mode
  - `category_title`: display title of sport category
  - `sport_type`: sport categorization code (int)
  - `started_at`: start time epoch milliseconds
  - `ended_at`: end time epoch milliseconds
  - `summary_json`: sports statistical details (pace, distance, heart rates)
  - `samples_json`: sports sample point entries
* **Example JSON**:
```json
{
  "id": "workout-12345",
  "mode_id": "running_mode",
  "mode_title": "Outdoor Run",
  "category_title": "Cardio",
  "sport_type": 1,
  "started_at": 1786524300000,
  "ended_at": 1786526100000,
  "summary_json": {"sportType":1,"durationSeconds":1800,"caloriesKcal":250.0,"distanceMeters":4000,"steps":4800,"avgHeartRate":145,"maxHeartRate":165,"minHeartRate":110},
  "samples_json": []
}
```
