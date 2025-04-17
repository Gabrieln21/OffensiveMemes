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
    }
];