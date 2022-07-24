import Joi from 'joi'
import { getCustomIdAdapters } from '../src/utils/custom-id'

function stringOfLength (length: number): string {
  return Array.from({ length }).fill('@').join('')
}

describe('custom id', () => {
  describe('with no schema', () => {
    const { to: toCustomId, from: fromCustomId } = getCustomIdAdapters()

    describe('fromCustomId', () => {
      it('fails if value is invalid JSON', () => {
        expect(fromCustomId('').err).toBeTruthy()
        expect(fromCustomId('one').err).toBeTruthy()
      })

      it('fails if the value is missing the `name` property', () => {
        expect(fromCustomId('{"id": "two"}').err).toBeTruthy()
      })

      it('fails if the `name` property is not a string', () => {
        expect(fromCustomId('{"id": "two", "name": 1}').err).toBeTruthy()
      })

      it('fails if the value is missing the `id` property', () => {
        expect(fromCustomId('{"name": "one"}').err).toBeTruthy()
      })

      it('fails if the `id` property is not a string', () => {
        expect(fromCustomId('{"name": "one", "id": 2}').err).toBeTruthy()
      })

      it('creates the correct object', () => {
        expect(fromCustomId('{"name": "one", "id": "two"}').unwrap()).toEqual({ name: 'one', id: 'two' })
      })

      it('allows additional properties', () => {
        expect(fromCustomId('{"name": "one", "id": "two", "foo": "bar"}').unwrap()).toEqual({
          name: 'one',
          id: 'two',
          foo: 'bar'
        })
      })
    })

    describe('toCustomId', () => {
      it('creates custom IDs correctly', () => {
        expect(toCustomId({ name: 'one', id: 'two' })).toBe('{"name":"one","id":"two"}')
      })

      it('creates the custom ID if the total length is 100 characters', () => {
        const parts = '{"name":"","id":"two"}'
        const veryLongProperty = stringOfLength(100 - parts.length)
        expect(toCustomId({ name: veryLongProperty, id: 'two' })).toBe(`{"name":"${veryLongProperty}","id":"two"}`)
      })

      it('throws if the generated id exceeds 100 characters', () => {
        const parts = '{"name":"","id":"two"}'
        const veryLongProperty = stringOfLength(100 - parts.length + 1)
        expect(() => toCustomId({ name: veryLongProperty, id: 'two' })).toThrow()
      })
    })
  })

  describe('with custom schema', () => {
    const { to: toCustomId, from: fromCustomId } = getCustomIdAdapters({
      foo: Joi.string().required()
    })

    describe('fromCustomId', () => {
      it('fails if the value is missing the `name` property', () => {
        expect(fromCustomId('{"id": "two", "foo": "three"}').err).toBeTruthy()
      })

      it('fails if the `name` property is not a string', () => {
        expect(fromCustomId('{"id": "two", "foo": "three", "name": 1}').err).toBeTruthy()
      })

      it('fails if the value is missing the `id` property', () => {
        expect(fromCustomId('{"name": "one", "foo": "three"}').err).toBeTruthy()
      })

      it('fails if the `id` property is not a string', () => {
        expect(fromCustomId('{"name": "one", "foo": "three", "id": 2}').err).toBeTruthy()
      })

      it('creates the correct object', () => {
        expect(fromCustomId('{"name": "one", "id": "two", "foo": "three"}').unwrap())
          .toEqual({ name: 'one', id: 'two', foo: 'three' })
      })

      it('allows additional properties', () => {
        expect(fromCustomId('{"name": "one", "id": "two", "foo": "three", "bar": "four"}').unwrap()).toEqual({
          name: 'one',
          id: 'two',
          foo: 'three',
          bar: 'four'
        })
      })
    })

    describe('toCustomId', () => {
      it('validates invalid objects at compile-time', () => {
        // @ts-expect-error
        toCustomId({ name: 'one', id: 'two' })
        expect(true).toBe(true)
      })

      it('creates custom IDs correctly', () => {
        expect(toCustomId({ name: 'one', id: 'two', foo: 'three' }))
          .toBe('{"name":"one","id":"two","foo":"three"}')
      })
    })
  })
})
