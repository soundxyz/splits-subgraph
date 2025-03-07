import { BigInt, Address, log } from '@graphprotocol/graph-ts'
import {
  Split,
  Recipient,
  Token,
  TokenInternalBalance,
  TokenWithdrawal,
  User,
  Transaction,
  SetSplitEvent,
  DistributionEvent,
  DistributeDistributionEvent,
  ControlTransferEvent,
  FromUserControlTransferEvent,
  ToUserControlTransferEvent,
  ReceiveDistributionEvent,
  RecipientAddedEvent,
  RecipientRemovedEvent,
  TokenWithdrawalEvent,
  WithdrawalEvent,
  WaterfallModule,
  VestingModule,
  LiquidSplit,
  Swapper,
  PassThroughWallet,
  TokenDistribution,
  ContractEarnings,
  ContractEarningsWithdrawal,
  ContractEarningsInternalBalance,
} from '../generated/schema'

export const PERCENTAGE_SCALE = BigInt.fromI64(1e6 as i64)
export const ZERO = BigInt.fromI32(0)
export const ONE = BigInt.fromI32(1)
export const TWO = BigInt.fromI32(2)

export const ZERO_ADDRESS = Address.zero().toHexString()
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001'

export const SET_SPLIT_EVENT_PREFIX = 'sse'
export const ADDED_PREFIX = 'add'
export const REMOVED_PREFIX = 'rem'
export const RECEIVE_PREFIX = 'rec'
export const DISTRIBUTE_PREFIX = 'd'
export const DISTRIBUTION_EVENT_PREFIX = 'de'
export const TOKEN_PREFIX = 't'
export const WITHDRAWAL_EVENT_PREFIX = 'we'
export const TOKEN_WITHDRAWAL_SPLIT_PREFIX = 'w-s'
export const TOKEN_WITHDRAWAL_USER_PREFIX = 'w-u'
export const TOKEN_WITHDRAWAL_WATERFALL_PREFIX = 'w-w'
export const TOKEN_INTERNAL_BALANCE_PREFIX = 'ib'
export const TOKEN_DISTRIBUTION_BALANCE_PREFIX = 'd'
export const CONTROL_TRANSFER_EVENT_PREFIX = 'ct'
export const FROM_USER_PREFIX = 'fu'
export const TO_USER_PREFIX = 'tu'
export const ID_SEPARATOR = '-'
export const CONTRACT_EARNINGS_PREFIX = 'ce'
export const CONTRACT_EARINGS_WITHDRAWAL_PREFIX = 'w'
export const CONTRACT_EARNINGS_INTERNAL_BALANCE_PREFIX = 'ib'

export const TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const WETH_DEPOSIT_EVENT_TOPIC =
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'
export const WETH_WITHDRAWAL_EVENT_TOPIC =
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65'

export function createJointId(args: Array<string>): string {
  return args.join(ID_SEPARATOR)
}

function addInternalBalance(
  splitId: string,
  accountId: string,
  tokenId: string,
  amount: BigInt,
  isDistributorIncentive: boolean,
): void {
  let accountTokenInternalBalanceId = createJointId([
    TOKEN_INTERNAL_BALANCE_PREFIX,
    accountId,
    tokenId,
  ])
  let accountTokenInternalBalance = TokenInternalBalance.load(
    accountTokenInternalBalanceId,
  )
  if (!accountTokenInternalBalance) {
    accountTokenInternalBalance = new TokenInternalBalance(
      accountTokenInternalBalanceId,
    )
    accountTokenInternalBalance.account = accountId
    accountTokenInternalBalance.token = tokenId
    accountTokenInternalBalance.amount = ZERO
  }
  accountTokenInternalBalance.amount =
    accountTokenInternalBalance.amount.plus(amount)
  accountTokenInternalBalance.save()

  // TODO: Not including distributor incentives for now. Need to decide if they'll be lumped into
  // contractEarnings or a separate distributionEarnings entity.
  if (isDistributorIncentive) return

  let contractEarningsId = saveContractEarnings(splitId, accountId).id
  let contractEarningsInternalBalanceId = createJointId([
    CONTRACT_EARNINGS_INTERNAL_BALANCE_PREFIX,
    contractEarningsId,
    tokenId,
  ])
  let contractEarningsInternalBalance = ContractEarningsInternalBalance.load(
    contractEarningsInternalBalanceId,
  )
  if (!contractEarningsInternalBalance) {
    contractEarningsInternalBalance = new ContractEarningsInternalBalance(
      contractEarningsInternalBalanceId,
    )
    contractEarningsInternalBalance.contractEarnings = contractEarningsId
    contractEarningsInternalBalance.token = tokenId
    contractEarningsInternalBalance.amount = ZERO
  }
  contractEarningsInternalBalance.amount =
    contractEarningsInternalBalance.amount.plus(amount)
  contractEarningsInternalBalance.save()
}

function saveContractEarnings(
  contractId: string,
  accountId: string,
): ContractEarnings {
  let contractEarningsId = createJointId([
    CONTRACT_EARNINGS_PREFIX,
    contractId,
    accountId,
  ])
  let contractEarnings = ContractEarnings.load(contractEarningsId)
  if (!contractEarnings) {
    contractEarnings = new ContractEarnings(contractEarningsId)
    contractEarnings.contract = contractId
    contractEarnings.account = accountId
    contractEarnings.save()
  }

  return contractEarnings
}

export function saveSetSplitEvent(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  splitId: string,
  type: string,
): void {
  let tx = Transaction.load(txHash)
  if (!tx) tx = new Transaction(txHash)
  let setSplitEvents = tx.setSplitEvents
  if (!setSplitEvents) setSplitEvents = new Array<string>()

  let setSplitEventId = createJointId([
    SET_SPLIT_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
  ])
  let setEvent = new SetSplitEvent(setSplitEventId)
  setEvent.timestamp = timestamp
  setEvent.transaction = txHash
  setEvent.logIndex = logIdx
  setEvent.account = splitId
  setEvent.type = type
  setEvent.save()
  setSplitEvents.push(setSplitEventId)

  tx.setSplitEvents = setSplitEvents
  tx.save()
}

export function saveSplitRecipientAddedEvent(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  accountId: string,
  ownership: BigInt,
): void {
  let setSplitEventId = createJointId([
    SET_SPLIT_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
  ])

  let recipientAddedEventId = createJointId([
    ADDED_PREFIX,
    setSplitEventId,
    accountId,
  ])
  let recipientAddedEvent = new RecipientAddedEvent(recipientAddedEventId)
  recipientAddedEvent.timestamp = timestamp
  recipientAddedEvent.account = accountId
  recipientAddedEvent.logIndex = logIdx
  recipientAddedEvent.setSplitEvent = setSplitEventId
  recipientAddedEvent.ownership = ownership
  recipientAddedEvent.save()
}

export function saveSplitRecipientRemovedEvent(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  accountId: string,
): void {
  let setSplitEventId = createJointId([
    SET_SPLIT_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
  ])

  let recipientRemovedEventId = createJointId([
    REMOVED_PREFIX,
    setSplitEventId,
    accountId,
  ])
  let recipientRemovedEvent = new RecipientRemovedEvent(recipientRemovedEventId)
  recipientRemovedEvent.timestamp = timestamp
  recipientRemovedEvent.account = accountId
  recipientRemovedEvent.logIndex = logIdx
  recipientRemovedEvent.setSplitEvent = setSplitEventId
  recipientRemovedEvent.save()
}

export function getAccountIdForSplitEvents(splitId: string): string {
  // If the split is downstream of a liquid split, save the distribution event
  // on the liquid split
  const split = getSplit(splitId)
  if (!split) return splitId

  if (!split.controller.equals(Address.fromString(ZERO_ADDRESS))) {
    const liquidSplit = LiquidSplit.load(split.controller.toHexString())
    if (liquidSplit) {
      return split.controller.toHexString()
    }
  }
  return splitId
}

export function saveDistributeEvent(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  splitId: string,
  tokenId: string,
  amount: BigInt,
): string {
  let tx = Transaction.load(txHash)
  if (!tx) tx = new Transaction(txHash)
  let distEvents = tx.distributionEvents
  if (!distEvents) distEvents = new Array<string>()

  // Handle regular split vs liquid split
  let accountId = getAccountIdForSplitEvents(splitId)

  let distEventId = createJointId([
    DISTRIBUTION_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
  ])
  let distEvent = new DistributionEvent(distEventId)
  distEvent.timestamp = timestamp
  distEvent.transaction = txHash
  distEvent.logIndex = logIdx
  distEvent.account = accountId
  distEvent.amount = amount
  distEvent.token = tokenId
  distEvent.save()
  distEvents.push(distEventId)

  tx.distributionEvents = distEvents
  tx.save()

  return accountId
}

export function distributeSplit(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  splitId: string,
  tokenId: string,
  amount: BigInt,
  distributorAddress: Address,
  blockNumber: i32,
): void {
  const split = getSplit(splitId)
  if (!split) return

  const token = new Token(tokenId)
  token.save()

  const distributionEventId = createJointId([
    DISTRIBUTION_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
  ])

  updateDistributionAmount(splitId, tokenId, amount)

  const splitTokenBalanceId = createJointId([splitId, tokenId])
  const splitTokenInternalBalanceId = createJointId([
    TOKEN_INTERNAL_BALANCE_PREFIX,
    splitTokenBalanceId,
  ])
  const splitTokenInternalBalance = TokenInternalBalance.load(
    splitTokenInternalBalanceId,
  )
  if (splitTokenInternalBalance) {
    splitTokenInternalBalance.amount = ZERO
    splitTokenInternalBalance.save()
  }

  // Only update split if necessary
  const needsSplitUpdate = blockNumber > split.latestBlock
  if (needsSplitUpdate) {
    split.latestBlock = blockNumber
    split.latestActivity = timestamp
    split.save()
  }

  // Prepare batches for entity storage
  const receiveEvents: ReceiveDistributionEvent[] = []
  const internalBalancesToSave: TokenInternalBalance[] = []
  const contractEarningsInternalBalancesToSave: ContractEarningsInternalBalance[] =
    []

  // Handle distributor fee
  const distributorFee = split.distributorFee
  let remainingAmount = amount
  if (distributorFee.notEqual(ZERO)) {
    const distributorAmount = amount.times(distributorFee).div(PERCENTAGE_SCALE)
    remainingAmount = amount.minus(distributorAmount)

    // if address is zero, dont give to any account (don't know msg.sender)
    if (!distributorAddress.equals(Address.zero())) {
      const distributorAddressString = distributorAddress.toHexString()

      // 'Create' the user in case they don't exist yet
      createUserIfMissing(distributorAddressString, blockNumber, timestamp)

      // Create and collect entities but don't save yet
      const accountTokenInternalBalanceId = createJointId([
        TOKEN_INTERNAL_BALANCE_PREFIX,
        distributorAddressString,
        tokenId,
      ])
      let accountTokenInternalBalance = TokenInternalBalance.load(
        accountTokenInternalBalanceId,
      )
      if (!accountTokenInternalBalance) {
        accountTokenInternalBalance = new TokenInternalBalance(
          accountTokenInternalBalanceId,
        )
        accountTokenInternalBalance.account = distributorAddressString
        accountTokenInternalBalance.token = tokenId
        accountTokenInternalBalance.amount = ZERO
      }
      accountTokenInternalBalance.amount =
        accountTokenInternalBalance.amount.plus(distributorAmount)
      internalBalancesToSave.push(accountTokenInternalBalance)

      const distributeDistributionEventId = createJointId([
        DISTRIBUTE_PREFIX,
        distributionEventId,
        distributorAddressString,
      ])
      const distributeDistributionEvent = new DistributeDistributionEvent(
        distributeDistributionEventId,
      )
      distributeDistributionEvent.timestamp = timestamp
      distributeDistributionEvent.account = distributorAddressString
      distributeDistributionEvent.token = tokenId
      distributeDistributionEvent.amount = distributorAmount
      distributeDistributionEvent.distributionEvent = distributionEventId
      distributeDistributionEvent.save()
    }
  }

  // Preload all recipients to avoid loading them one by one in the loop
  const recipients = split.recipients
  const recipientEntities: Map<string, Recipient> = new Map()

  // Preload all recipient entities
  for (let i = 0; i < recipients.length; i++) {
    const recipientId = recipients[i]
    const recipient = Recipient.load(recipientId)
    if (recipient) {
      recipientEntities.set(recipientId, recipient as Recipient)
    }
  }

  // Process all recipients in batch
  for (let i: i32 = 0; i < recipients.length; i++) {
    const recipientId = recipients[i]
    // Use preloaded recipient
    const recipient = recipientEntities.get(recipientId)
    if (!recipient) continue // Skip if recipient not found

    const ownership = recipient.ownership
    const recipientAmount = remainingAmount
      .times(ownership)
      .div(PERCENTAGE_SCALE)

    // Create internal balance entity
    const accountId = recipient.account
    const accountTokenInternalBalanceId = createJointId([
      TOKEN_INTERNAL_BALANCE_PREFIX,
      accountId,
      tokenId,
    ])
    let accountTokenInternalBalance = TokenInternalBalance.load(
      accountTokenInternalBalanceId,
    )
    if (!accountTokenInternalBalance) {
      accountTokenInternalBalance = new TokenInternalBalance(
        accountTokenInternalBalanceId,
      )
      accountTokenInternalBalance.account = accountId
      accountTokenInternalBalance.token = tokenId
      accountTokenInternalBalance.amount = ZERO
    }
    accountTokenInternalBalance.amount =
      accountTokenInternalBalance.amount.plus(recipientAmount)
    internalBalancesToSave.push(accountTokenInternalBalance)

    // Create contract earnings internal balance
    const contractEarningsId = saveContractEarnings(splitId, accountId).id
    const contractEarningsInternalBalanceId = createJointId([
      CONTRACT_EARNINGS_INTERNAL_BALANCE_PREFIX,
      contractEarningsId,
      tokenId,
    ])
    let contractEarningsInternalBalance = ContractEarningsInternalBalance.load(
      contractEarningsInternalBalanceId,
    )
    if (!contractEarningsInternalBalance) {
      contractEarningsInternalBalance = new ContractEarningsInternalBalance(
        contractEarningsInternalBalanceId,
      )
      contractEarningsInternalBalance.contractEarnings = contractEarningsId
      contractEarningsInternalBalance.token = tokenId
      contractEarningsInternalBalance.amount = ZERO
    }
    contractEarningsInternalBalance.amount =
      contractEarningsInternalBalance.amount.plus(recipientAmount)
    contractEarningsInternalBalancesToSave.push(contractEarningsInternalBalance)

    // Create distribution event
    const receiveDistributionEventId = createJointId([
      RECEIVE_PREFIX,
      distributionEventId,
      recipient.account,
    ])
    const receiveDistributionEvent = new ReceiveDistributionEvent(
      receiveDistributionEventId,
    )
    receiveDistributionEvent.timestamp = timestamp
    receiveDistributionEvent.account = recipient.account
    receiveDistributionEvent.token = tokenId
    receiveDistributionEvent.amount = recipientAmount
    receiveDistributionEvent.distributionEvent = distributionEventId
    receiveEvents.push(receiveDistributionEvent)
  }

  // Save all entities in batches
  for (let i = 0; i < internalBalancesToSave.length; i++) {
    internalBalancesToSave[i].save()
  }

  for (let i = 0; i < contractEarningsInternalBalancesToSave.length; i++) {
    contractEarningsInternalBalancesToSave[i].save()
  }

  for (let i = 0; i < receiveEvents.length; i++) {
    receiveEvents[i].save()
  }
}

export function saveWithdrawalEvent(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  accountId: string,
): string {
  let tx = Transaction.load(txHash)
  if (!tx) tx = new Transaction(txHash)
  let withdrawEvents = tx.withdrawEvents
  if (!withdrawEvents) withdrawEvents = new Array<string>()

  let withdrawalEventId = createJointId([
    WITHDRAWAL_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
    accountId,
  ])
  let withdrawalEvent = new WithdrawalEvent(withdrawalEventId)
  withdrawalEvent.timestamp = timestamp
  withdrawalEvent.account = accountId
  withdrawalEvent.logIndex = logIdx
  withdrawalEvent.transaction = txHash
  withdrawalEvent.save()
  withdrawEvents.push(withdrawalEventId)

  tx.withdrawEvents = withdrawEvents
  tx.save()

  return withdrawalEventId
}

export function saveControlTransferEvents(
  timestamp: BigInt,
  txHash: string,
  logIdx: BigInt,
  splitId: string,
  type: string,
  fromUserId: string,
  toUserId: string,
): void {
  let tx = Transaction.load(txHash)
  if (!tx) tx = new Transaction(txHash)
  tx.save()

  let controlTransferEventId = createJointId([
    CONTROL_TRANSFER_EVENT_PREFIX,
    txHash,
    logIdx.toString(),
  ])
  let controlTransferEvent = new ControlTransferEvent(controlTransferEventId)
  controlTransferEvent.timestamp = timestamp
  controlTransferEvent.account = splitId
  controlTransferEvent.logIndex = logIdx
  controlTransferEvent.type = type
  controlTransferEvent.transaction = txHash
  controlTransferEvent.save()

  let fromUserControlTransferEventId = createJointId([
    FROM_USER_PREFIX,
    controlTransferEventId,
    fromUserId,
  ])
  let fromUserControlTransferEvent = new FromUserControlTransferEvent(
    fromUserControlTransferEventId,
  )
  fromUserControlTransferEvent.timestamp = timestamp
  fromUserControlTransferEvent.account = fromUserId
  fromUserControlTransferEvent.logIndex = logIdx
  fromUserControlTransferEvent.controlTransferEvent = controlTransferEventId
  fromUserControlTransferEvent.save()

  if (toUserId !== Address.zero().toHexString()) {
    let toUserControlTransferEventId = createJointId([
      TO_USER_PREFIX,
      controlTransferEventId,
      toUserId,
    ])
    let toUserControlTransferEvent = new ToUserControlTransferEvent(
      toUserControlTransferEventId,
    )
    toUserControlTransferEvent.timestamp = timestamp
    toUserControlTransferEvent.account = toUserId
    toUserControlTransferEvent.logIndex = logIdx
    toUserControlTransferEvent.controlTransferEvent = controlTransferEventId
    toUserControlTransferEvent.save()
  }
}

export function handleTokenWithdrawalEvent(
  withdrawalEventId: string,
  tokenId: string,
  amount: BigInt,
): void {
  let tokenWithdrawalEventId = createJointId([
    TOKEN_PREFIX,
    withdrawalEventId,
    tokenId,
  ])
  let tokenWithdrawalEvent = new TokenWithdrawalEvent(tokenWithdrawalEventId)
  tokenWithdrawalEvent.token = tokenId
  tokenWithdrawalEvent.amount = amount
  tokenWithdrawalEvent.withdrawalEvent = withdrawalEventId
  tokenWithdrawalEvent.save()
}

export function handleTokenWithdrawal(
  accountId: string,
  tokenId: string,
  amount: BigInt,
  blockNumber: i32,
  timestamp: BigInt,
): void {
  updateWithdrawalAmount(null, accountId, tokenId, amount)

  let tokenBalanceId = createJointId([accountId, tokenId])
  let tokenInternalBalanceId = createJointId([
    TOKEN_INTERNAL_BALANCE_PREFIX,
    tokenBalanceId,
  ])
  let tokenInternalBalance = TokenInternalBalance.load(tokenInternalBalanceId)
  if (!tokenInternalBalance) {
    tokenInternalBalance = new TokenInternalBalance(tokenInternalBalanceId)
    tokenInternalBalance.account = accountId
    tokenInternalBalance.token = tokenId
  }

  tokenInternalBalance.amount = ONE
  tokenInternalBalance.save()

  let user = User.load(accountId)
  if (user) {
    if (blockNumber > user.latestBlock) {
      user.latestBlock = blockNumber
      user.latestActivity = timestamp
      user.save()
    }
  }
}

export function updateWithdrawalAmount(
  contractId: string | null,
  accountId: string,
  tokenId: string,
  amount: BigInt,
): void {
  // Create TokenWithdrawal if account is a user
  if (getUser(accountId)) {
    let tokenBalanceId = createJointId([accountId, tokenId])

    let tokenWithdrawalId = createJointId([
      TOKEN_WITHDRAWAL_USER_PREFIX,
      tokenBalanceId,
    ])
    let tokenWithdrawal = TokenWithdrawal.load(tokenWithdrawalId)
    if (!tokenWithdrawal) {
      tokenWithdrawal = new TokenWithdrawal(tokenWithdrawalId)
      tokenWithdrawal.account = accountId
      tokenWithdrawal.token = tokenId
      tokenWithdrawal.amount = ZERO
    }
    tokenWithdrawal.amount = tokenWithdrawal.amount.plus(amount)
    tokenWithdrawal.save()
  }

  // Modify ContractEarnings
  if (contractId && contractId !== accountId) {
    // Funds were pushed directly to the recipient, did not go through split main
    let contractEarningsId = saveContractEarnings(contractId, accountId).id
    let contractEarningsWithdrawalId = createJointId([
      CONTRACT_EARINGS_WITHDRAWAL_PREFIX,
      contractEarningsId,
      tokenId,
    ])
    let contractEarningsWithdrawal = ContractEarningsWithdrawal.load(
      contractEarningsWithdrawalId,
    )
    if (!contractEarningsWithdrawal) {
      contractEarningsWithdrawal = new ContractEarningsWithdrawal(
        contractEarningsWithdrawalId,
      )
      contractEarningsWithdrawal.contractEarnings = contractEarningsId
      contractEarningsWithdrawal.token = tokenId
      contractEarningsWithdrawal.amount = ZERO
    }
    contractEarningsWithdrawal.amount =
      contractEarningsWithdrawal.amount.plus(amount)
    contractEarningsWithdrawal.save()
  } else if (contractId === accountId || !contractId) {
    // Funds were pushed throughs split main
    // contractId === accountId => split distribution, !contractId => split main withdrawal
    // Move contract earnings internal balances over to contract earnings withdrawals
    let contractEarningsArray = getContractEarnings(accountId)
    for (let i = 0; i < contractEarningsArray.length; i++) {
      let contractEarnings = contractEarningsArray[i]
      let contractEarningsInternalBalanceId = createJointId([
        CONTRACT_EARNINGS_INTERNAL_BALANCE_PREFIX,
        contractEarnings.id,
        tokenId,
      ])
      let contractEarningsInternalBalance =
        ContractEarningsInternalBalance.load(contractEarningsInternalBalanceId)
      if (contractEarningsInternalBalance) {
        if (contractEarningsInternalBalance.amount.gt(ZERO)) {
          let contractEarningsWithdrawalId = createJointId([
            CONTRACT_EARINGS_WITHDRAWAL_PREFIX,
            contractEarnings.id,
            tokenId,
          ])
          let contractEarningsWithdrawal = ContractEarningsWithdrawal.load(
            contractEarningsWithdrawalId,
          )
          if (!contractEarningsWithdrawal) {
            contractEarningsWithdrawal = new ContractEarningsWithdrawal(
              contractEarningsWithdrawalId,
            )
            contractEarningsWithdrawal.contractEarnings = contractEarnings.id
            contractEarningsWithdrawal.token = tokenId
            contractEarningsWithdrawal.amount = ZERO
          }
          contractEarningsWithdrawal.amount =
            contractEarningsWithdrawal.amount.plus(
              contractEarningsInternalBalance.amount,
            )
          contractEarningsWithdrawal.save()

          contractEarningsInternalBalance.amount = ZERO
          contractEarningsInternalBalance.save()
        }
      }
    }
  }
}

export function updateDistributionAmount(
  accountId: string,
  tokenId: string,
  amount: BigInt,
): void {
  let tokenBalanceId = createJointId([accountId, tokenId])

  let tokenDistributionId = createJointId([
    TOKEN_DISTRIBUTION_BALANCE_PREFIX,
    tokenBalanceId,
  ])
  let tokenDistribution = TokenDistribution.load(tokenDistributionId)
  if (!tokenDistribution) {
    tokenDistribution = new TokenDistribution(tokenDistributionId)
    tokenDistribution.account = accountId
    tokenDistribution.token = tokenId
    tokenDistribution.amount = ZERO
  }
  tokenDistribution.amount = tokenDistribution.amount.plus(amount)
  tokenDistribution.save()
}

const CHAOS_LIQUID_SPLIT = '0x8427e46826a520b1264b55f31fcb5ddfdc31e349'
export function createUserIfMissing(
  accountId: string,
  blockNumber: i32,
  timestamp: BigInt,
): void {
  // First check if user already exists before checking other entity types
  let user = User.load(accountId)
  if (user) return

  // Check if accountId points to a Chaos Liquid Split
  if (accountId === CHAOS_LIQUID_SPLIT) return

  // Check if accountId points to another module (using a single load for each entity type)
  let split = Split.load(accountId)
  if (split) return

  let waterfall = WaterfallModule.load(accountId)
  if (waterfall) return

  let vesting = VestingModule.load(accountId)
  if (vesting) return

  let liquidSplit = LiquidSplit.load(accountId)
  if (liquidSplit) return

  let swapper = Swapper.load(accountId)
  if (swapper) return

  let passThroughWallet = PassThroughWallet.load(accountId)
  if (passThroughWallet) return

  // Create the user if it doesn't exist and isn't another module
  user = new User(accountId)
  user.createdBlock = blockNumber
  user.save()
}

// Local cache for contract earnings to avoid redundant loads
const contractEarningsCache = new Map<string, ContractEarnings[]>()

function getContractEarnings(accountId: string): ContractEarnings[] {
  // Check if we have already loaded this account's contract earnings
  if (contractEarningsCache.has(accountId)) {
    return contractEarningsCache.get(accountId) as ContractEarnings[]
  }

  let result: ContractEarnings[] = []

  const user = getUser(accountId)
  if (user) {
    result = user.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  const split = getSplit(accountId, false)
  if (split) {
    result = split.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  const waterfall = getWaterfallModule(accountId, false)
  if (waterfall) {
    result = waterfall.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  const vesting = getVestingModule(accountId, false)
  if (vesting) {
    result = vesting.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  const liquidSplit = getLiquidSplit(accountId, false)
  if (liquidSplit) {
    result = liquidSplit.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  const swapper = getSwapper(accountId, false)
  if (swapper) {
    result = swapper.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  const passThroughWallet = getPassThroughWallet(accountId, false)
  if (passThroughWallet) {
    result = passThroughWallet.contractEarnings.load()
    contractEarningsCache.set(accountId, result)
    return result
  }

  // If nothing found, store empty array in cache to avoid redundant lookups
  contractEarningsCache.set(accountId, [])
  return []
}

export function getSplit(
  splitId: string,
  required: boolean = true,
): Split | null {
  let split = Split.load(splitId)
  if (!split) {
    let splitUser = User.load(splitId)
    if (splitUser) {
      // It's a valid case where the split doesn't exist. Just exit.
      log.warning('Trying to fetch a split, but a user already exists: {}', [
        splitId,
      ])
      return null
    }
    if (required) throw new Error('Split must exist')
  }

  return split
}

export function getWaterfallModule(
  waterfallModuleId: string,
  required: boolean = true,
): WaterfallModule | null {
  let waterfall = WaterfallModule.load(waterfallModuleId)
  if (!waterfall) {
    let waterfallUser = User.load(waterfallModuleId)
    if (waterfallUser) {
      // It's a valid case where the waterfall doesn't exist. Just exit.
      log.warning(
        'Trying to fetch a waterfall, but a user already exists: {}',
        [waterfallModuleId],
      )
      return null
    }
    if (required) throw new Error('Waterfall must exist')
  }

  return waterfall
}

export function getVestingModule(
  vestingModuleId: string,
  required: boolean = true,
): VestingModule | null {
  let vesting = VestingModule.load(vestingModuleId)
  if (!vesting) {
    let vestingUser = User.load(vestingModuleId)
    if (vestingUser) {
      // It's a valid case where the vesting doesn't exist. Just exit.
      log.warning('Trying to fetch a vesting, but a user already exists: {}', [
        vestingModuleId,
      ])
      return null
    }
    if (required) throw new Error('Vesting must exist')
  }

  return vesting
}

export function getLiquidSplit(
  liquidSplitId: string,
  required: boolean = true,
): LiquidSplit | null {
  let liquidSplit = LiquidSplit.load(liquidSplitId)
  if (!liquidSplit) {
    let liquidSplitUser = User.load(liquidSplitId)
    if (liquidSplitUser) {
      // It's a valid case where the liquid split doesn't exist. Just exit.
      log.warning(
        'Trying to fetch a liquid split, but a user already exists: {}',
        [liquidSplitId],
      )
      return null
    }
    if (required) throw new Error('Liquid split must exist')
  }

  return liquidSplit
}

export function getSwapper(
  swapperId: string,
  required: boolean = true,
): Swapper | null {
  let swapper = Swapper.load(swapperId)
  if (!swapper) {
    let swapperUser = User.load(swapperId)
    if (swapperUser) {
      // It's a valid case where the swapper doesn't exist. Just exit.
      log.warning('Trying to fetch a swapper, but a user already exists: {}', [
        swapperId,
      ])
      return null
    }
    if (required) throw new Error('Swapper must exist')
  }

  return swapper
}

export function getPassThroughWallet(
  passThroughWalletId: string,
  required: boolean = true,
): PassThroughWallet | null {
  let passThroughWallet = PassThroughWallet.load(passThroughWalletId)
  if (!passThroughWallet) {
    let passThroughWalletUser = User.load(passThroughWalletId)
    if (passThroughWalletUser) {
      // It's a valid case where the pass through wallet doesn't exist. Just exit.
      log.warning(
        'Trying to fetch a pass through wallet, but a user already exists: {}',
        [passThroughWalletId],
      )
      return null
    }
    if (required) throw new Error('Pass through wallet must exist')
  }

  return passThroughWallet
}

export function getUser(userId: string): User | null {
  let user = User.load(userId)
  return user
}

export function createTransactionIfMissing(txHash: string): void {
  let tx = Transaction.load(txHash)
  if (!tx) {
    tx = new Transaction(txHash)
    tx.save()
  }
}

// TODO: is there really nothing built-in for this??
export function getAddressHexFromBytes32(bytesAddress: string): string {
  let prefix = bytesAddress.slice(0, 2)
  let address = bytesAddress.slice(26)
  return prefix + address
}

export function getBigIntFromString(str: string, start: i32, end: i32): BigInt {
  let strSlice = str.slice(start, end)
  let value = parseInt(strSlice, 16)
  return BigInt.fromString(value.toString().slice(0, -2))
}
