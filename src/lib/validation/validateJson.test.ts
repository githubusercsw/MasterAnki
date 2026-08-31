import { describe, it, expect } from 'vitest';
import { validateFactsResponse, validateFlashcardsResponse, isValidCardType } from './validateJson';

describe('validateFactsResponse', () => {
  it('parses valid facts', () => {
    const res = validateFactsResponse({ sourceTitle: 't', facts: [{ fact: 'A' }, { fact: 'B' }] });
    expect(res.facts).toHaveLength(2);
    expect(res.facts[0].fact).toBe('A');
    expect(res.facts[0].id).toBeTruthy();
  });

  it('filters empty facts and assigns ids', () => {
    const res = validateFactsResponse({ facts: [{ fact: '  ' }, { fact: 'ok' }, 'bad'] });
    expect(res.facts).toHaveLength(1);
    expect(res.facts[0].fact).toBe('ok');
  });

  it('throws when facts is not an array', () => {
    expect(() => validateFactsResponse({ facts: 'nope' })).toThrow();
    expect(() => validateFactsResponse(null)).toThrow();
  });
});

describe('validateFlashcardsResponse', () => {
  it('parses valid basic cards', () => {
    const res = validateFlashcardsResponse({
      deck: 'D',
      cards: [{ front: 'Q', back: 'A', tags: ['x'] }],
    });
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0].type).toBe('basic');
    expect(res.cards[0].status).toBe('pending');
  });

  it('rejects unknown card types', () => {
    const res = validateFlashcardsResponse({
      cards: [{ type: 'weird', front: 'Q', back: 'A' }],
    });
    expect(res.cards).toHaveLength(0);
  });

  it('accepts cloze and image_occlusion types', () => {
    const res = validateFlashcardsResponse({
      cards: [
        { type: 'cloze', front: 'x {{c1::y}}', back: 'y' },
        { type: 'image_occlusion', front: 'img', back: 'note', imageUrl: 'data:img' },
      ],
    });
    expect(res.cards).toHaveLength(2);
    expect(res.cards[0].type).toBe('cloze');
    expect(res.cards[1].imageUrl).toBe('data:img');
  });

  it('throws on missing cards array', () => {
    expect(() => validateFlashcardsResponse({})).toThrow();
  });
});

describe('isValidCardType', () => {
  it('accepts only whitelisted types', () => {
    expect(isValidCardType('basic')).toBe(true);
    expect(isValidCardType('cloze')).toBe(true);
    expect(isValidCardType('image_occlusion')).toBe(true);
    expect(isValidCardType('other')).toBe(false);
  });
});
