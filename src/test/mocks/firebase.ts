import type { Timestamp } from 'firebase/firestore'

export function fakeTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    isEqual: (other: Timestamp) => other.toMillis() === date.getTime(),
  } as Timestamp
}

export function fakeTimestampNow(): Timestamp {
  return fakeTimestamp(new Date())
}
