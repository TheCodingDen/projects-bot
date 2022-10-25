export const apiSubmissionSchema = {
  type: 'object',
  required: [
    'name',
    'authorId',
    'description',
    'tech',
    'links'
  ],
  properties: {
    name: { type: 'string' },
    authorId: { type: 'string' },
    description: { type: 'string' },
    tech: { type: 'string' },

    links: {
      type: 'object',
      required: [
        'source',
        'other'
      ],
      properties: {
        source: { type: 'string' },
        other: { type: 'string' }
      }
    }
  }
} as const
