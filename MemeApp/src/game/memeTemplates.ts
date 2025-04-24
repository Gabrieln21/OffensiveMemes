/**
 * Meme Templates Collection
 * Defines the available meme templates for the game
 */

export interface MemeTemplate {
    id: string;
    url: string;
    captionFields: number;
    name: string;
    description?: string;
    category?: string;
}

export const memeTemplates: MemeTemplate[] = [
    {
        id: 'drake',
        url: '/memes/drake.jpg',
        captionFields: 2,
        name: 'Drake Hotline Bling',
        description: 'Drake appears to be rejecting something in the top panel and approving something in the bottom panel',
        category: 'reaction'
    },
    {
        id: 'toy-story-meme',
        url: '/memes/toy-story.jpg',
        captionFields: 1,
        name: 'Toy Story Buzz and Woody',
        description: 'blah',
        category: 'blah'
    },
    {
        id: 'fry1',
        url: '/memes/fry1.jpg',
        captionFields: 3,
        name: 'Fry1',
        description: 'fry1',
        category: 'decision'
    },
    {
        id: 'two-buttons',
        url: '/memes/twobuttons.jpg',
        captionFields: 2,
        name: 'two-buttons',
        description: 'two-buttons panels showing increasingly complex ideas with expanding brain images',
        category: 'two-buttons'
    },
    {
        id: 'blackdude',
        url: '/memes/blackdude.jpg',
        captionFields: 2,
        name: 'blackdude',
        description: 'blackdude',
        category: 'blackdude'
    },
    {
        id: 'kid',
        url: '/memes/kid.jpg',
        captionFields: 1,
        name: 'kid',
        description: 'kid',
        category: 'kid'
    },
    {
        id: 'gru',
        url: '/memes/gru.jpg',
        captionFields: 4,
        name: 'gru',
        description: 'gru',
        category: 'gru'
    },
    {
        id: 'brian',
        url: '/memes/brian.jpg',
        captionFields: 2,
        name: 'brian',
        description: 'brian',
        category: 'brian'
    },
    {
        id: 'boom',
        url: '/memes/boom.jpg',
        captionFields: 4,
        name: 'boom',
        description: 'boom',
        category: 'boom'
    },
    {
        id: 'fry2',
        url: '/memes/fry2.jpg',
        captionFields: 1,
        name: 'fry2',
        description: 'fry2',
        category: 'fry2'
    },
    {
        id: 'head',
        url: '/memes/head.jpg',
        captionFields: 1,
        name: 'head',
        description: 'head',
        category: 'head'
    },
    {
        id: 'lookback',
        url: '/memes/lookback.jpg',
        captionFields: 3,
        name: 'lookback',
        description: 'lookback',
        category: 'lookback'
    },
    {
        id: 'old',
        url: '/memes/old.jpg',
        captionFields: 2,
        name: 'old',
        description: 'old',
        category: 'old'
    },
    {
        id: 'zoom',
        url: '/memes/zoom.jpg',
        captionFields: 2,
        name: 'zoom',
        description: 'zoom',
        category: 'zoom'
    },
    {
        id: 'poop',
        url: '/memes/poop.jpg',
        captionFields: 1,
        name: 'poop',
        description: 'poop',
        category: 'poop'
    },
    {
        id: 'confused',
        url: '/memes/confused.jpg',
        captionFields: 1,
        name: 'confused',
        description: 'confused',
        category: 'confused'
    },
    {
        id: 'google',
        url: '/memes/google.jpg',
        captionFields: 2,
        name: 'google',
        description: 'google',
        category: 'google'
    },
    {
        id: 'creep',
        url: '/memes/creep.jpg',
        captionFields: 2,
        name: 'creep',
        description: 'creep',
        category: 'creep'
    },
    {
        id: 'sponge',
        url: '/memes/sponge.jpg',
        captionFields: 1,
        name: 'sponge',
        description: 'sponge',
        category: 'sponge'
    },
    {
        id: 'grumpy',
        url: '/memes/grumpy.jpg',
        captionFields: 2,
        name: 'grumpy',
        description: 'grumpy',
        category: 'grumpy'
    },
    {
        id: 'tired',
        url: '/memes/tired.jpg',
        captionFields: 1,
        name: 'tired',
        description: 'tired',
        category: 'tired'
    },
    {
        id: 'sponge2',
        url: '/memes/sponge2.jpg',
        captionFields: 1,
        name: 'sponge2',
        description: 'sponge2',
        category: 'sponge2'
    },
    {
        id: 'duku',
        url: '/memes/duku.jpg',
        captionFields: 1,
        name: 'duku',
        description: 'duku',
        category: 'duku'
    },
    {
        id: 'bear',
        url: '/memes/bear.jpg',
        captionFields: 1,
        name: 'bear',
        description: 'bear',
        category: 'bear'
    },
    {
        id: 'cryingj',
        url: '/memes/cryingj.jpg',
        captionFields: 1,
        name: 'cryingj',
        description: 'cryingj',
        category: 'cryingj'
    },
    {
        id: 'wtf',
        url: '/memes/wtf.jpg',
        captionFields: 2,
        name: 'wtf',
        description: 'wtf',
        category: 'wtf'
    },
    {
        id: 'think',
        url: '/memes/think.jpg',
        captionFields: 2,
        name: 'think',
        description: 'think',
        category: 'think'
    },
    {
        id: 'girl_cry',
        url: '/memes/girl_cry.jpg',
        captionFields: 2,
        name: 'girl_cry',
        description: 'girl_cry',
        category: 'girl_cry'
    },
    {
        id: 'change_my_mind',
        url: '/memes/change_my_mind.jpg',
        captionFields: 1,
        name: 'change_my_mind',
        description: 'change_my_mind',
        category: 'change_my_mind'
    },
    {
        id: 'raptor',
        url: '/memes/raptor.jpg',
        captionFields: 2,
        name: 'raptor',
        description: 'raptor',
        category: 'raptor'
    },
    {
        id: 'shaq',
        url: '/memes/shaq.jpg',
        captionFields: 1,
        name: 'shaq',
        description: 'shaq',
        category: 'shaq'
    },
    
];