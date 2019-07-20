import { MpcServer, Participant, INVALIDATED_AFTER, MpcState } from './mpc-server';
import { Wallet } from 'web3x/wallet';
import moment, { Moment } from 'moment';
import { Address } from 'web3x/address';

const TEST_BAD_THINGS = [2];

export class DemoServer implements MpcServer {
  private wallet: Wallet;
  private state: MpcState;

  constructor(numParticipants: number, private startTime: Moment, private youIndex?: number) {
    this.wallet = Wallet.fromMnemonic(
      'face cook metal cost prevent term foam drive sure caught pet gentle',
      numParticipants
    );

    const participants = this.wallet.currentAddresses().map(
      (address, i): Participant => ({
        state: 'WAITING',
        runningState: 'WAITING',
        position: i + 1,
        progress: 0,
        address,
      })
    );

    this.state = {
      startTime,
      participants,
    };
  }

  start() {
    setInterval(() => this.advanceState(), 500);
  }

  private advanceState() {
    if (moment().isBefore(this.startTime)) {
      return;
    }

    const { completedAt, participants } = this.state;

    if (!completedAt && participants.every(p => p.state === 'COMPLETE' || p.state === 'INVALIDATED')) {
      this.state.completedAt = moment();
    }

    const i = participants.findIndex(p => p.state !== 'COMPLETE' && p.state !== 'INVALIDATED');
    const p = participants[i];

    if (!p) {
      return;
    }

    if (p.state === 'WAITING') {
      p.startedAt = moment();
      p.state = 'RUNNING';
      return;
    }

    if (
      moment()
        .subtract(INVALIDATED_AFTER, 's')
        .isAfter(p.startedAt!)
    ) {
      p.state = 'INVALIDATED';
      p.error = 'timed out';
      this.advanceState();
      return;
    }

    if (i === this.youIndex) {
      // Only simulate other users.
      return;
    }

    if (TEST_BAD_THINGS.includes(i)) {
      // Exceptional case: Simulate user offline for 10 seconds.
      if (i === 1) {
        if (
          moment()
            .subtract(20, 's')
            .isAfter(p.startedAt!)
        ) {
          p.completedAt = moment();
          p.state = 'COMPLETE';
          this.advanceState();
        }
        return;
      }

      if (i === 2) {
        if (p.runningState === 'VERIFYING') {
          p.state = 'INVALIDATED';
          p.runningState = 'COMPLETE';
          p.error = 'verify failed';
          this.advanceState();
          return;
        }
      }

      // Exceptional case: Simulate a user that never participates.
      if (i === 3) {
        if (
          moment()
            .subtract(INVALIDATED_AFTER, 's')
            .isAfter(p.startedAt!)
        ) {
          p.state = 'INVALIDATED';
          p.error = 'timed out';
          this.advanceState();
        }
        return;
      }
    }

    p.lastUpdate = moment();

    if (p.runningState === 'WAITING') {
      if (i === 4) {
        p.runningState = 'OFFLINE';
        setTimeout(() => {
          p.completedAt = moment();
          p.state = 'COMPLETE';
        }, 15000);
      } else {
        p.runningState = 'DOWNLOADING';
        setTimeout(() => {
          p.runningState = 'COMPUTING';
        }, 3000);
      }
      return;
    }

    if (p.runningState === 'COMPUTING') {
      p.progress = Math.min(100, p.progress + Math.floor(3 + Math.random() * 5));
      if (p.progress >= 100) {
        p.runningState = 'UPLOADING';
        setTimeout(() => {
          p.runningState = 'VERIFYING';
          this.advanceState();
        }, 3000);
      }
      return;
    }

    if (p.runningState === 'VERIFYING') {
      setTimeout(() => {
        p.completedAt = moment();
        p.runningState = 'COMPLETE';
        p.state = 'COMPLETE';
        this.advanceState();
      }, 3000);
    }
  }

  async getState(): Promise<MpcState> {
    return this.state;
  }

  async updateParticipant(participantData: Participant) {
    const { address, runningState, progress, error } = participantData;
    const p = this.getRunningParticipant(address);
    p.runningState = runningState;
    p.progress = progress;
    p.error = error;
    p.lastUpdate = moment();
  }

  async uploadData(address: Address, g1Path: string, g2Path: string) {
    const p = this.getRunningParticipant(address);
    p.runningState = 'VERIFYING';
    p.lastUpdate = moment();
    setTimeout(() => {
      p.state = 'COMPLETE';
      p.runningState = 'COMPLETE';
      p.lastUpdate = moment();
      p.completedAt = moment();
    }, 4000);
  }

  private getRunningParticipant(address: Address) {
    const p = this.getParticipant(address);
    if (p.state !== 'RUNNING') {
      throw new Error('Can only update a running participant.');
    }
    return p;
  }

  private getParticipant(address: Address) {
    const p = this.state.participants.find(p => p.address.equals(address));
    if (!p) {
      throw new Error(`Participant with address ${address} not found.`);
    }
    return p;
  }

  getPrivateKeyAt(i: number) {
    return this.wallet.get(i)!.privateKey;
  }
}
