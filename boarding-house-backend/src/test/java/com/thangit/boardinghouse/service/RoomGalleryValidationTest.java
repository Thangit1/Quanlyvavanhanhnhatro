package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class RoomGalleryValidationTest {
    @Test void rejectsForeignDuplicateMissingAndUnreferencedUploads(){
        for(var items:List.of(List.of("foreign"),List.of("upload:0","upload:0"),List.of("upload:1"),List.of("upload:../../x"),List.<String>of()))
            assertThatThrownBy(()->RoomImageService.validateGallery(new RoomImageService.Gallery(items,0),1,Set.of())).isInstanceOf(RuntimeException.class);
    }
    @Test void enforcesTenImagesAndSingleValidCover(){
        var ten=java.util.stream.IntStream.range(0,10).mapToObj(i->"upload:"+i).toList();
        assertThatCode(()->RoomImageService.validateGallery(new RoomImageService.Gallery(ten,9),10,Set.of())).doesNotThrowAnyException();
        assertThatThrownBy(()->RoomImageService.validateGallery(new RoomImageService.Gallery(ten,10),10,Set.of())).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->RoomImageService.validateGallery(new RoomImageService.Gallery(ten,0),11,Set.of())).isInstanceOf(RuntimeException.class);
    }
}
