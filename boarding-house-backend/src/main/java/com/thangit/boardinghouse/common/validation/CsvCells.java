package com.thangit.boardinghouse.common.validation;
public final class CsvCells {
 private CsvCells(){}
 public static String quote(Object value){String text=value==null?"":value.toString();if(value instanceof CharSequence&&!text.isEmpty()){String leading=text.stripLeading();if((!leading.isEmpty()&&"=+-@".indexOf(leading.charAt(0))>=0)||text.charAt(0)=='\t'||text.charAt(0)=='\r'||text.charAt(0)=='\n')text="'"+text;}return "\""+text.replace("\"","\"\"")+"\"";}
}
