import { ProjectsClient } from '../client'

export abstract class Model<SerialisedT> {
  constructor (protected client: ProjectsClient) { }

  /**
   *  Converts this model to its serialised type.
   */
  abstract toSerialised (): SerialisedT
}
