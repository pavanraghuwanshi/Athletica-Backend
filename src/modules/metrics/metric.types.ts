export const metricNames = [
  'heartRate',
  'pedometer',
  'sleep',
  'bloodOxygen',
  'bloodGlucose',
  'bloodComponents',
  'bodyTemperature',
  'hrv',
  'stress',
  'met',
  'bloodPressure',
  'bodyComposition',
  'ecg',
  'sportsWorkout',
] as const

export type MetricName = (typeof metricNames)[number]
export type MetricRecord = Record<string, unknown> & { id?: unknown }

export const metricCollectionNames: Record<MetricName, string> = {
  heartRate: 'bandpro_heart_rate',
  pedometer: 'bandpro_pedometer',
  sleep: 'bandpro_sleep',
  bloodOxygen: 'bandpro_blood_oxygen',
  bloodGlucose: 'bandpro_blood_glucose',
  bloodComponents: 'bandpro_blood_components',
  bodyTemperature: 'bandpro_body_temperature',
  hrv: 'bandpro_hrv',
  stress: 'bandpro_stress',
  met: 'bandpro_met',
  bloodPressure: 'bandpro_blood_pressure',
  bodyComposition: 'bandpro_body_composition',
  ecg: 'bandpro_ecg',
  sportsWorkout: 'bandpro_sports_workout',
}

export const metricTimestampFields: Record<MetricName, string[]> = {
  heartRate: ['recorded_at'],
  pedometer: ['date'],
  sleep: ['date'],
  bloodOxygen: ['date'],
  bloodGlucose: ['date'],
  bloodComponents: ['date'],
  bodyTemperature: ['date'],
  hrv: ['date'],
  stress: ['date'],
  met: ['date'],
  bloodPressure: ['recorded_at'],
  bodyComposition: ['recorded_at'],
  ecg: ['recorded_at'],
  sportsWorkout: ['started_at'],
}
