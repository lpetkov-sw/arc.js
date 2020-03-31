import gql from 'graphql-tag'
import { Observable } from 'rxjs'
import { first } from 'rxjs/operators'
import { Arc, IApolloQueryOptions } from '../arc'
// import { DAO } from './dao'
import { IGenesisProtocolParams } from '../genesisProtocol'
import {
  ITransaction,
  Operation,
  toIOperationObservable,
  transactionErrorHandler,
  transactionResultHandler
} from '../operation'
import {
  IProposalCreateOptions,
  IProposalQueryOptions, Proposal } from '../proposal'
import { Address, ICommonQueryOptions, IStateful } from '../types'
// import * as ContributionReward from './contributionReward'
// import * as ContributionRewardExt from './schemes/contributionRewardExt'
// import * as GenericScheme from './genericScheme'
import { ReputationFromTokenScheme } from './reputationFromToken'
// import * as SchemeRegistrar from './schemeRegistrar'
// import * as UGenericScheme from './uGenericScheme'

export interface ISchemeState {
  id: string
  address: Address
  dao: Address
  name: string
  paramsHash: string
  version: string
  canDelegateCall: boolean
  canRegisterSchemes: boolean
  canUpgradeController: boolean
  canManageGlobalConstraints: boolean
  contributionRewardParams?: IContributionRewardParams
  contributionRewardExtParams?: IContributionRewardExtParams
  genericSchemeParams?: IGenericSchemeParams
  schemeRegistrarParams?: {
    votingMachine: Address
    voteRemoveParams: IGenesisProtocolParams
    voteRegisterParams: IGenesisProtocolParams
  } | null
  numberOfQueuedProposals: number
  numberOfPreBoostedProposals: number
  numberOfBoostedProposals: number
  uGenericSchemeParams?: IGenericSchemeParams
  schemeParams?: IGenericSchemeParams | IContributionRewardParams | IContributionRewardExtParams | ISchemeRegisterParams
}

export interface IGenericSchemeParams {
  votingMachine: Address
  contractToCall: Address
  voteParams: IGenesisProtocolParams
}

export interface IContributionRewardParams {
  votingMachine: Address
  voteParams: IGenesisProtocolParams
}
export interface IContributionRewardExtParams {
  votingMachine: Address
  voteParams: IGenesisProtocolParams
  rewarder: Address
}

export interface ISchemeRegisterParams {
  votingMachine: Address
  contractToCall: Address
  voteParams: IGenesisProtocolParams
}

export interface ISchemeQueryOptions extends ICommonQueryOptions {
  where?: {
    address?: Address
    canDelegateCall?: boolean
    canRegisterSchemes?: boolean
    canUpgradeController?: boolean
    canManageGlobalConstraints?: boolean
    dao?: Address
    id?: string
    name?: string
    paramsHash?: string
    [key: string]: any
  }
}

export interface ISchemeQueryOptions extends ICommonQueryOptions {
  where?: {
    address?: Address
    canDelegateCall?: boolean
    canRegisterSchemes?: boolean
    canUpgradeController?: boolean
    canManageGlobalConstraints?: boolean
    dao?: Address
    id?: string
    name?: string
    paramsHash?: string
    [key: string]: any
  }
}

/**
 * A Scheme represents a scheme instance that is registered at a DAO
 */
export abstract class SchemeBase implements IStateful<ISchemeState> {
  public static fragments = {
    SchemeFields: gql`
    fragment SchemeFields on ControllerScheme {
      id
      address
      name
      dao { id }
      canDelegateCall
      canRegisterSchemes
      canUpgradeController
      canManageGlobalConstraints
      paramsHash
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
      contributionRewardExtParams {
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
        rewarder
      }
      genericSchemeParams {
        votingMachine
        contractToCall
        voteParams {
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
      schemeRegistrarParams {
        votingMachine
        voteRemoveParams {
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
        voteRegisterParams {
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
      numberOfQueuedProposals
      numberOfPreBoostedProposals
      numberOfBoostedProposals
      uGenericSchemeParams {
        votingMachine
        contractToCall
        voteParams {
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
      version
    }`
  }

  public id: Address
  public coreState: ISchemeState | null = null
  public ReputationFromToken: ReputationFromTokenScheme | null = null

  constructor(public context: Arc, idOrOpts: Address | ISchemeState) {
    this.context = context
    if (typeof idOrOpts === 'string') {
      this.id = idOrOpts as string
      this.id = this.id.toLowerCase()
    } else {
      this.setState(idOrOpts)
      this.id = (this.coreState as ISchemeState).id
    }
  }

  /**
   * fetch the static state from the subgraph
   * @return the statatic state
   */
  public async fetchState(apolloQueryOptions: IApolloQueryOptions = {}): Promise < ISchemeState > {
    const state = await this.state(apolloQueryOptions).pipe(first()).toPromise()
    if (state.name ===  'ReputationFromToken') {
      this.ReputationFromToken = new ReputationFromTokenScheme(this)
    }
    this.setState(state)
    return state
  }

  public setState(opts: ISchemeState) {
    this.coreState = opts
  }

  public createProposal(options: IProposalCreateOptions): Operation<Proposal>  {
    const observable = Observable.create(async (observer: any) => {
      try {
        const createTransaction = await this.createProposalTransaction(options)
        const map = this.createProposalTransactionMap()
        const errHandler = this.createProposalErrorHandler(options)
        const sendTransactionObservable = this.context.sendTransaction(
          createTransaction, map, errHandler
        )
        const sub = sendTransactionObservable.subscribe(observer)
        return () => sub.unsubscribe()
      } catch (e) {
        observer.error(e)
        return
      }
    })

    return toIOperationObservable(observable)
  }

  public abstract state(apolloQueryOptions?: IApolloQueryOptions): Observable < ISchemeState >

  public proposals(
    options: IProposalQueryOptions = {},
    apolloQueryOptions: IApolloQueryOptions = {}
  ): Observable < Proposal[] > {
    if (!options.where) { options.where = {}}
    options.where.scheme = this.id
    return Proposal.search(this.context, options, apolloQueryOptions)
  }

  /**
   * create a new proposal in this scheme
   * TODO: move this to the schemes - we should call proposal.scheme.createProposal
   * @param  options [description ]
   * @return a Proposal instance
   */
  protected abstract async createProposalTransaction(
    options: IProposalCreateOptions
  ): Promise<ITransaction>

  protected abstract createProposalTransactionMap(): transactionResultHandler<Proposal>

  protected abstract createProposalErrorHandler(
    options: IProposalCreateOptions
  ): transactionErrorHandler
}
