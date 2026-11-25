package com.thangit.boardinghouse.service;

/** External transport boundary. No configured provider exists in this repository.
 * A future network adapter must dispatch outside database transactions using a lease and provider idempotency.
 */
public interface CommunicationSender {
 record Result(String outcome,String code,String providerReference,boolean retryable){}
 Result unavailableOrSend(String channel,String businessKey,long recipient,String title,String body);
 default Result send(long property,String channel,String businessKey,long recipient,String title,String body){return unavailableOrSend(channel,businessKey,recipient,title,body);}
 default boolean independentWorker(){return false;}
 class Unconfigured implements CommunicationSender {
  @Override public Result unavailableOrSend(String channel,String key,long recipient,String title,String body){return new Result("FAILED","CHANNEL_NOT_CONFIGURED",null,false);}
 }
}
