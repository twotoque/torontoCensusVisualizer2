import { type CellInfo } from "../cell/CellViewer";

export type MsgRole = "user" | "assistant" | "disambiguation";

export interface DisambigOption {
  row_id: number;
  year: number;
  label: string;
  document?: string;
}

export interface Message {
  id: string;
  role: MsgRole;
  content: string;
  options?: DisambigOption[];
  question?: string;
  cell?: CellInfo;
}
