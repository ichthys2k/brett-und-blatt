import type { GameUi } from '@brett-und-blatt/ui';
import type { BinokelState, BinokelMove } from '../types';
import React from 'react';

const Board: React.FC<any> = () => {
  return React.createElement('div', null, 'Binokel');
};

export const gameUi: GameUi<BinokelState, BinokelMove> = {
  Board,
  SeatSymbol: () => null as any,
  seatLabel: (seat: number) => `Spieler ${seat + 1}`,
};

export default gameUi;
