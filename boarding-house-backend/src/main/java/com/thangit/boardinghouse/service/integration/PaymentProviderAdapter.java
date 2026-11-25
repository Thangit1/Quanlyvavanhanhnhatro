package com.thangit.boardinghouse.service.integration;

/** Provider result vocabulary; signature/merchant/amount validation precedes this mapping. */
public interface PaymentProviderAdapter {
    record Result(String status,String code){}
    static Result vnpay(String response,String transaction){
        if(response==null||!response.matches("[0-9]{2}")||transaction==null||!transaction.matches("[0-9]{2}"))throw IntegrationCenter.invalid("VNPAY_RESULT_INVALID");
        return new Result("00".equals(response)&&"00".equals(transaction)?"SUCCESS":"24".equals(response)?"CANCELLED":"11".equals(response)?"EXPIRED":"FAILED","VNPAY_"+response);
    }
    static Result momo(String code){
        if(code==null||!code.matches("[0-9]{1,8}"))throw IntegrationCenter.invalid("MOMO_RESULT_INVALID");
        return new Result(switch(code){case "0"->"SUCCESS";case "1000","9000"->"PENDING";case "1003","1006","1017"->"CANCELLED";case "1005"->"EXPIRED";default->"FAILED";},"MOMO_"+code);
    }
}
