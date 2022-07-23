import { incomingSubmissionValidator } from '../src/models/schema/submission'

describe('validation', () => {
  it('fails if not enough props are passed', () => {
    expect(incomingSubmissionValidator.validate({ name: '' }).error).toBeDefined()
  })

  it('fails if values are null when required', () => {
    expect(incomingSubmissionValidator.validate({ name: null }).error).toBeDefined()
    expect(incomingSubmissionValidator.validate({ author: null }).error).toBeDefined()
    expect(incomingSubmissionValidator.validate({ description: null }).error).toBeDefined()
    expect(incomingSubmissionValidator.validate({ tech: null }).error).toBeDefined()
    expect(incomingSubmissionValidator.validate({ links: null }).error).toBeDefined()

    expect(incomingSubmissionValidator.validate({ links: { source: null } }).error).toBeDefined()
    expect(incomingSubmissionValidator.validate({ links: { other: null } }).error).toBeDefined()
  })

  it('fails when an invalid snowflake is passed', () => {
    expect(incomingSubmissionValidator.validate({ author: 'notasnowflake' }).error).toBeDefined()
    expect(incomingSubmissionValidator.validate({ author: '241742873287128327138217381273128937' }).error).toBeDefined()
  })

  it('passes when all values are accurate', () => {
    expect(incomingSubmissionValidator.validate({
      name: 'name',
      author: '123456789101112',
      description: 'description',
      tech: 'tech',
      links: {
        source: 'source',
        other: 'other'
      }
    }).value).toBeDefined()
  })
})
