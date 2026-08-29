import { createRoomFb, joinRoomFb } from "./firebase-engine";

export type CreateRoomInput = {
  mode: "5" | "11";
  auctionType?: "blind" | "live" | undefined;
  name: string;
  playerId: string;
};

export type JoinRoomInput = {
  code: string;
  name: string;
  playerId: string;
};

export async function createRoomDirect(data: CreateRoomInput) {
  return createRoomFb(data.mode, data.name, data.playerId, data.auctionType ?? "blind");
}

export async function joinRoomDirect(data: JoinRoomInput) {
  return joinRoomFb(data.code, data.name, data.playerId);
}