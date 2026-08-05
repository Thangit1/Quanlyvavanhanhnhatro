package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.util.List;

public interface AdminPropertyService {
    PropertyList listProperties(AuthenticatedUser principal,String keyword,String status,int page,int size);
    PropertyDetail property(AuthenticatedUser principal,long id);
    Created createProperty(AuthenticatedUser principal,SaveProperty request);
    PropertyDetail updateProperty(AuthenticatedUser principal,long id,SaveProperty request);
    void propertyStatus(AuthenticatedUser principal,long id,String status,Long version);
    Created createBuilding(AuthenticatedUser principal,long propertyId,SaveBuilding request);
    Created createFloor(AuthenticatedUser principal,long buildingId,SaveFloor request);
    PropertyOptions options(AuthenticatedUser principal);
    RoomList listRooms(AuthenticatedUser principal,Long propertyId,Long buildingId,Long floorId,String status,String keyword,int page,int size);
    RoomDetail room(AuthenticatedUser principal,long id);
    Created createRoom(AuthenticatedUser principal,SaveRoom request);
    RoomDetail updateRoom(AuthenticatedUser principal,long id,SaveRoom request);
    List<Created> bulkCreate(AuthenticatedUser principal,BulkCreateRooms request);
    RoomDetail changePrice(AuthenticatedUser principal,long id,ChangePrice request);
    RoomDetail changeStatus(AuthenticatedUser principal,long id,ChangeStatus request);
}
