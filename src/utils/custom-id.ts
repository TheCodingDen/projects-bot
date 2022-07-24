import Joi from 'joi'
import { Result } from 'ts-results'
import { assert } from './assert'

type CustomId<T> = T & {name: string, id: string}

interface CustomIdAdapters<T> {
  to: (args: CustomId<T>) => string
  from: (customId: string) => Result<CustomId<T>, Error>
}

const BASE_SCHEMA = Joi.object({
  name: Joi.string().required(),
  id: Joi.string().required()
}).unknown(true)

/**
 * Given an optional partial schema, generates a pair of functions to convert to and from a customId.
 *
 * This is intended for use with d.js `Interaction` so we can encode additional data in a type-safe manner.
 *
 * Example usage:
 * ```
 * const { to: toCustomId, from: fromCustomId } = getCustomIdAdapters<{ additionalData: string }>({
 *   additionalData: Joi.string().required()
 * })
 *
 * // returns an object of type { name: string; id: string; additionalData: string }
 * fromCustomId(interaction.customId)
 *
 * new Modal()
 *   .setCustomId(toCustomId({ name: commandName, id: submission.id, additionalData: 'butts' }))
 * ```
 */
export function getCustomIdAdapters<TAdditionalData> (
  additionalDataSchema?: Joi.PartialSchemaMap<TAdditionalData>
): CustomIdAdapters<TAdditionalData> {
  const schema = additionalDataSchema ? BASE_SCHEMA.append(additionalDataSchema) : BASE_SCHEMA

  return {
    from (customId: string): Result<CustomId<TAdditionalData>, Error> {
      return Result.wrap(() => Joi.attempt(JSON.parse(customId), schema))
    },
    to (args: CustomId<TAdditionalData>): string {
      const str = JSON.stringify(args)
      assert(str.length <= 100, `data ${str} is too long to be a custom ID`)
      return str
    }
  }
}
