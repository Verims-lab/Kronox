export * as questionGateway from './questionGateway';
export * as categoryGateway from './categoryGateway';
export * as inviteGateway from './inviteGateway';
export * as lobbyGateway from './lobbyGateway';
export * as scoringGateway from './scoringGateway';
export * as economyGateway from './economyGateway';
export * as dailyQuestGateway from './dailyQuestGateway';
export * as leaderboardGateway from './leaderboardGateway';
export * as analyticsGateway from './analyticsGateway';
export * as cleanupGateway from './cleanupGateway';

export const dbGatewayArchitectureContract = Object.freeze({
  protectedQuestionReads: 'questionGateway -> getQuestions',
  publicLeaderboardProjection: 'leaderboardGateway -> SoloLeaderboardEntry',
  analyticsRuntimeGateway: 'analyticsGateway -> QuestionAttemptEvent',
  marketPurchaseGateway: 'economyGateway -> purchaseJokerWithDiamonds',
  dailyQuestDefinitionGateway: 'dailyQuestGateway -> createDailyQuestDefinition',
  dailyQuestRuntimeGateway: 'dailyQuestGateway -> getDailyQuestStatus / recordDailyQuestProgress / claimDailyQuestReward',
  cleanupJobs: 'cleanupGateway -> admin backend functions',
});
