package com.thangit.boardinghouse.common.validation;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CsvCellsTest {
    @Test void spreadsheetFormulaPayloadsAreText() {
        for (String value : new String[]{"=HYPERLINK(\"https://example.invalid\")", " +SUM(1,2)", "-1+2", "@SUM(1,2)", "\tcommand", "\ncommand"}) {
            assertThat(CsvCells.quote(value)).startsWith("\"'");
        }
    }
    @Test void genuineNegativeNumbersKeepTheirNumericValue() {
        assertThat(CsvCells.quote(new BigDecimal("-12.50"))).isEqualTo("\"-12.50\"");
    }
    @Test void normalTextEscapesQuotesAndNullIsEmpty() {
        assertThat(CsvCells.quote("A \"quoted\" name")).isEqualTo("\"A \"\"quoted\"\" name\"");
        assertThat(CsvCells.quote(null)).isEqualTo("\"\"");
    }
}
