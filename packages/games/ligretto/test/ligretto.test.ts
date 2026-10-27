import { describe, expect, it } from 'vitest';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';

describe('ligretto', () => {
  it('erfüllt die allgemeinen Spielprüfungen', () => {
    gameContractChecks(gameModule);
  });
});
