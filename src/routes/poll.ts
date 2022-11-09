import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ShortUniqueId  from 'short-unique-id';
import { prisma } from '../lib/prisma';
import { authenticate } from '../plugins/authenticate';

export async function pollRoutes(fastify: FastifyInstance) {
  fastify.get('/polls/count', async () => {
    const count = await prisma.poll.count()
    return { count }
  });

  fastify.post('/polls', async (request, reply) => {
    const createPollBody = z.object({
      title: z.string(),
    });

    const { title } = createPollBody.parse(request.body)

    const generate = new ShortUniqueId({ length: 6 })
    const code = String(generate()).toUpperCase();

    try {
        await request.jwtVerify();
         await prisma.poll.create({
           data: {
             title,
             code,
             ownerId: request.user.sub,

             participants: {
              create: {
                userId: request.user.sub,
              }
             }
           },
         })
    } catch {
       await prisma.poll.create({
         data: {
           title,
           code,
         },
       });      
    }

   

    return reply.status(201).send({ code })
  });

  fastify.post('/polls/join', {
    onRequest: [authenticate]
  }, async (request, reply) => {
    const joinPollBody = z.object({
      code: z.string(),
    });

    const { code } = joinPollBody.parse(request.body);

    const poll = await prisma.poll.findUnique({
      where: {
        code,
      },
      include: {
        participants: {
          where: {
            userId: request.user.sub,
          }
        }
      }
    });

    if (!poll) {
      return reply.status(400).send({
        message: 'Poll not found.'
      });
    }

    if (poll.participants.length > 0) {
      return reply.status(400).send({
        message: 'You already joined this poll.'
      })
    }

    if (!poll.ownerId) {
      await prisma.poll.update({
        where: {
          id: poll.id,
        }, 
        data: {
          ownerId: request.user.sub,
        }
      })
    }

    await prisma.participant.create({
      data: {
        pollId: poll.id,
        userId: request.user.sub,
      }
    });

    return reply.status(201).send();

  });

  fastify.get('/polls', {
    onRequest: [authenticate]
  }, async (request) => {
    const polls = await prisma.poll.findMany({
      where: {
        participants: {
          some: {
            userId: request.user.sub
          }
        }
      }, 
      include: {
        _count: {
          select: {
            participants: true,
          }
        },
        participants: {
          select: {
            id: true,

            user: {
              select: {
                avatarUrl: true,
              }
            }
          },
          take: 4
        },
        owner: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return { polls }
  });

  fastify.get('/polls/:id', {
    onRequest: [authenticate],
  }, async (request) => {
    const getPollParams = z.object({
      id: z.string(),
    });

    const { id } = getPollParams.parse(request.params);

    const polls = await prisma.poll.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            participants: true,
          },
        },
        participants: {
          select: {
            id: true,

            user: {
              select: {
                avatarUrl: true,
              },
            },
          },
          take: 4,
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return { polls }
  });
}