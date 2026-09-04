package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;

public interface RentalLifecycleService {
    LifecycleBoard board(AuthenticatedUser principal, Long propertyId);
    Created createBooking(AuthenticatedUser principal, CreateBooking request);
    void changeBookingStatus(AuthenticatedUser principal, long bookingId, ChangeBookingStatus request);
    Created createContract(AuthenticatedUser principal, long bookingId, CreateContract request);
    Created prepareCheckin(AuthenticatedUser principal, PrepareCheckin request);
    void completeCheckin(AuthenticatedUser principal, long checkinId, CompleteCheckin request);
    Created requestCheckout(AuthenticatedUser principal, RequestCheckout request);
    Settlement completeCheckout(AuthenticatedUser principal, long checkoutId, CompleteCheckout request);
}
