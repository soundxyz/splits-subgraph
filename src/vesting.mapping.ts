import { BigInt, log } from "@graphprotocol/graph-ts";
import {  CreateVestingModule } from "../generated/VestingModuleFactory/VestingModuleFactory";
import {
  CreateVestingStream,
  ReleaseFromVestingStream,
} from "../generated/VestingModule/VestingModule";
import {
  Token,
  Transaction,
  VestingModule,
  VestingStream,
  CreateVestingModuleEvent,
  CreateVestingStreamEvent,
  ReleaseVestingFundsEvent,
  User,
} from "../generated/schema";
import { createJointId, createTransactionIfMissing, getVestingModule } from "./helpers";

export const ZERO = BigInt.fromI32(0);

export const CREATE_VESTING_MODULE_EVENT_PREFIX = "cvme";
export const CREATE_VESTING_STREAM_EVENT_PREFIX = "cvse";
export const RELEASE_VESTING_FUNDS_EVENT_PREFIX = "rvfe";

export function handleCreateVestingModule(event: CreateVestingModule): void {
  // Save module
  let vestingModuleId = event.params.vestingModule.toHexString();

  // If a user already exists at this id, just return for now. Cannot have two
  // entities with the same id if they share an interface. Will handle this situation
  // in subgraph v2.
  let vestingUser = User.load(vestingModuleId);
  if (vestingUser) {
    log.warning('Trying to create a vesting module, but a user already exists: {}', [vestingModuleId]);
    return;
  }

  let vestingModule = new VestingModule(vestingModuleId);
  vestingModule.vestingPeriod = event.params.vestingPeriod;
  vestingModule.beneficiary = event.params.beneficiary.toHexString();
  vestingModule.latestBlock = event.block.number.toI32()
  vestingModule.save();

  // Save event
  let timestamp = event.block.timestamp;
  let txHash = event.transaction.hash.toHexString();
  createTransactionIfMissing(txHash);
  let logIdx = event.logIndex;

  let createVestingModuleEventId = createJointId([CREATE_VESTING_MODULE_EVENT_PREFIX, txHash, logIdx.toString()]);
  let createVestingModuleEvent = new CreateVestingModuleEvent(createVestingModuleEventId);
  createVestingModuleEvent.timestamp = timestamp;
  createVestingModuleEvent.transaction = txHash;
  createVestingModuleEvent.account = vestingModuleId;
  createVestingModuleEvent.save();
}

export function handleCreateVestingStream(event: CreateVestingStream): void {
  // Save stream
  let vestingModuleId = event.address.toHexString();

  let vestingModule = getVestingModule(vestingModuleId);
  if (!vestingModule) return;

  if (event.block.number.toI32() > vestingModule.latestBlock) {
    vestingModule.latestBlock = event.block.number.toI32();
    vestingModule.save();
  }

  let streamId = event.params.id;
  let tokenId = event.params.token.toHexString();
  let startTime = event.block.timestamp;
  let totalAmount = event.params.amount;

  let token = new Token(tokenId);
  token.save();

  let vestingStreamId = createJointId([vestingModuleId, streamId.toString()]);
  let vestingStream = new VestingStream(vestingStreamId);
  vestingStream.streamId = streamId;
  vestingStream.token = tokenId;
  vestingStream.totalAmount = totalAmount;
  vestingStream.startTime = startTime;
  vestingStream.account = vestingModuleId;
  vestingStream.claimedAmount = ZERO;
  vestingStream.save();

  // Save event
  let timestamp = event.block.timestamp;
  let txHash = event.transaction.hash.toHexString();
  createTransactionIfMissing(txHash);
  let logIdx = event.logIndex;

  let createVestingStreamEventId = createJointId([CREATE_VESTING_STREAM_EVENT_PREFIX, txHash, logIdx.toString()]);
  let createVestingStreamEvent = new CreateVestingStreamEvent(createVestingStreamEventId);
  createVestingStreamEvent.timestamp = timestamp;
  createVestingStreamEvent.transaction = txHash;
  createVestingStreamEvent.account = vestingModuleId;
  createVestingStreamEvent.token = tokenId;
  createVestingStreamEvent.amount = totalAmount;
  createVestingStreamEvent.save();
}

export function handleReleaseFromVestingStream(event: ReleaseFromVestingStream): void {
  // Update stream
  let vestingModuleId = event.address.toHexString();

  let vestingModule = getVestingModule(vestingModuleId);
  if (!vestingModule) return;

  if (event.block.number.toI32() > vestingModule.latestBlock) {
    vestingModule.latestBlock = event.block.number.toI32();
    vestingModule.save();
  }

  let streamId = event.params.id.toString();
  let transferAmount = event.params.amount;

  let vestingStreamId = createJointId([vestingModuleId, streamId]);
  // must exist
  let vestingStream = VestingStream.load(vestingStreamId) as VestingStream;
  vestingStream.claimedAmount += transferAmount;
  vestingStream.save();

  // Save event
  let timestamp = event.block.timestamp;
  let txHash = event.transaction.hash.toHexString();
  createTransactionIfMissing(txHash);
  let logIdx = event.logIndex;

  let releaseVestingFundsEventId = createJointId([RELEASE_VESTING_FUNDS_EVENT_PREFIX, txHash, logIdx.toString()]);
  let releaseVestingFundsEvent = new ReleaseVestingFundsEvent(releaseVestingFundsEventId);
  releaseVestingFundsEvent.timestamp = timestamp;
  releaseVestingFundsEvent.transaction = txHash;
  releaseVestingFundsEvent.account = vestingModuleId;
  releaseVestingFundsEvent.token = vestingStream.token;
  releaseVestingFundsEvent.amount = transferAmount;
  releaseVestingFundsEvent.save();
}
