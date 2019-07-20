import { Moment } from 'moment';
import { Address } from 'web3x/address';

export const INVALIDATED_AFTER = 60;

export type ParticipantState = 'WAITING' | 'RUNNING' | 'COMPLETE' | 'INVALIDATED';
export type ParticipantRunningState =
  | 'OFFLINE'
  | 'WAITING'
  | 'DOWNLOADING'
  | 'COMPUTING'
  | 'UPLOADING'
  | 'VERIFYING'
  | 'COMPLETE';

export interface Participant {
  state: ParticipantState;
  runningState: ParticipantRunningState;
  position: number;
  progress: number;
  startedAt?: Moment;
  lastUpdate?: Moment;
  completedAt?: Moment;
  address: Address;
  error?: string;
}

export interface MpcState {
  startTime: Moment;
  completedAt?: Moment;
  participants: Participant[];
}

export interface MpcServer {
  getState(): Promise<MpcState>;
  updateParticipant(participant: Participant): Promise<void>;
  uploadData(address: Address, g1Path: string, g2Path: string): Promise<void>;
}
