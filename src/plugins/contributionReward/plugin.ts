import BN from 'bn.js'
import gql from 'graphql-tag'
import {
  IProposalBaseCreateOptions,
  ProposalPlugin,
  Arc,
  IGenesisProtocolParams,
  mapGenesisProtocolParams,
  IPluginState,
  ITransaction,
  transactionResultHandler,
  ITransactionReceipt,
  getEventArgs,
  NULL_ADDRESS,
  IContributionRewardProposalState,
  Address,
  ContributionRewardProposal,
  Plugin,
  Logger
} from '../../index'
import { DocumentNode } from 'graphql'

export interface IContributionRewardState extends IPluginState {
  pluginParams: {
    votingMachine: Address
    voteParams: IGenesisProtocolParams
  }
}

export interface IProposalCreateOptionsCR extends IProposalBaseCreateOptions {
  beneficiary: Address
  nativeTokenReward?: BN
  reputationReward?: BN
  ethReward?: BN
  externalTokenReward?: BN
  externalTokenAddress?: Address
  periodLength?: number
  periods?: any
}

export class ContributionReward extends ProposalPlugin<IContributionRewardState, IContributionRewardProposalState, IProposalCreateOptionsCR> {

  private static _fragment: { name: string, fragment: DocumentNode } | undefined

  public static get fragment () {
    if(!this._fragment) {
      this._fragment = {
        name: 'ContributionRewardParams',
        fragment: gql` fragment ContributionRewardParams on ControllerScheme {
          contributionRewardParams {
            id
            votingMachine
            voteParams {
              id
              queuedVoteRequiredPercentage
              queuedVotePeriodLimit
              boostedVotePeriodLimit
              preBoostedVotePeriodLimit
              thresholdConst
              limitExponentValue
              quietEndingPeriod
              proposingRepReward
              votersReputationLossRatio
              minimumDaoBounty
              daoBountyConst
              activationTime
              voteOnBehalf
            }
          }
        }`
      }
    }

    return this._fragment
  }

  public static itemMap(context: Arc, item: any, query: DocumentNode): IContributionRewardState | null {
    if (!item) {
      Logger.debug(`ContributionReward Plugin ItemMap failed. Query: ${query.loc?.source.body}`)
      return null
    }

    const baseState = Plugin.itemMapToBaseState(context, item)

    const contributionRewardParams = item.contributionRewardParams && {
      voteParams: mapGenesisProtocolParams(item.contributionRewardParams.voteParams),
      votingMachine: item.contributionRewardParams.votingMachine
    }
    
    return {
        ...baseState,
        pluginParams: contributionRewardParams
      }
  }

  public async createProposalTransaction(options: IProposalCreateOptionsCR): Promise<ITransaction> {
    options.descriptionHash = await this.context.saveIPFSData(options)
  
    if (options.plugin === undefined) {
      throw new Error(`Missing argument "plugin" for ContributionReward in Proposal.create()`)
    }
  
    return {
      contract: this.context.getContract(options.plugin),
      method: 'proposeContributionReward',
      args: [
        options.descriptionHash || '',
        options.reputationReward && options.reputationReward.toString() || 0,
        [
          options.nativeTokenReward && options.nativeTokenReward.toString() || 0,
          options.ethReward && options.ethReward.toString() || 0,
          options.externalTokenReward && options.externalTokenReward.toString() || 0,
          options.periodLength || 0,
          options.periods || 1
        ],
        options.externalTokenAddress || NULL_ADDRESS,
        options.beneficiary
      ]
    }
  }

  public createProposalTransactionMap(): transactionResultHandler<any> {
    return async (receipt: ITransactionReceipt) => {
      const args = getEventArgs(receipt, 'NewContributionProposal', 'ContributionReward.createProposal')
      const proposalId = args[1]
      return new ContributionRewardProposal(this.context, proposalId)
    }
  }
  
}