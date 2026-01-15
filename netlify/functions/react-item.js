const prisma = require('./_shared/prisma');

// Get userId from request body (generated on client side and stored in localStorage)
function getUserId(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    return body.userId;
  } catch {
    return null;
  }
}

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { itemId, reaction, userId } = body;

    if (!itemId || !reaction || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'itemId, reaction, and userId are required' })
      };
    }

    if (!['like', 'dislike', 'heat'].includes(reaction)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Invalid reaction type' })
      };
    }


    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        reactions: {
          where: { userId }
        }
      }
    });

    if (!item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Item not found' })
      };
    }

    const existingReaction = item.reactions[0];

    // Check if user already reacted
    if (existingReaction) {
      // User can only react once - check if they're trying to change their reaction
      if (reaction === 'heat') {
        // Heat up can be toggled
        const newHeatedUp = !existingReaction.heatedUp;
        await prisma.userReaction.update({
          where: { id: existingReaction.id },
          data: { heatedUp: newHeatedUp }
        });

        // Update item counts
        await prisma.item.update({
          where: { id: itemId },
          data: {
            heatUps: newHeatedUp ? item.heatUps + 1 : item.heatUps - 1
          }
        });

        const updatedItem = await prisma.item.findUnique({
          where: { id: itemId }
        });

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            item: {
              ...updatedItem,
              uid: updatedItem.uid.toString()
            },
            userReaction: {
              liked: existingReaction.liked,
              disliked: existingReaction.disliked,
              heatedUp: newHeatedUp
            }
          })
        };
      } else {
        // Like/dislike - check if they already have one
        if (existingReaction.liked && reaction === 'like') {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'You already liked this item' })
          };
        }
        if (existingReaction.disliked && reaction === 'dislike') {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'You already disliked this item' })
          };
        }

        // Update existing reaction
        const updateData = {};
        const itemUpdateData = {};

        if (reaction === 'like') {
          if (existingReaction.disliked) {
            // Switching from dislike to like
            updateData.disliked = false;
            updateData.liked = true;
            itemUpdateData.dislikes = item.dislikes - 1;
            itemUpdateData.likes = item.likes + 1;
          } else {
            updateData.liked = true;
            itemUpdateData.likes = item.likes + 1;
          }
        } else if (reaction === 'dislike') {
          if (existingReaction.liked) {
            // Switching from like to dislike
            updateData.liked = false;
            updateData.disliked = true;
            itemUpdateData.likes = item.likes - 1;
            itemUpdateData.dislikes = item.dislikes + 1;
          } else {
            updateData.disliked = true;
            itemUpdateData.dislikes = item.dislikes + 1;
          }
        }

        await prisma.userReaction.update({
          where: { id: existingReaction.id },
          data: updateData
        });

        await prisma.item.update({
          where: { id: itemId },
          data: itemUpdateData
        });
      }
    } else {
      // Create new reaction
      const reactionData = {
        itemId,
        userId,
        heatedUp: false,
        liked: null,
        disliked: null
      };

      const itemUpdateData = {};

      if (reaction === 'heat') {
        reactionData.heatedUp = true;
        itemUpdateData.heatUps = item.heatUps + 1;
      } else if (reaction === 'like') {
        reactionData.liked = true;
        itemUpdateData.likes = item.likes + 1;
      } else if (reaction === 'dislike') {
        reactionData.disliked = true;
        itemUpdateData.dislikes = item.dislikes + 1;
      }

      await prisma.userReaction.create({
        data: reactionData
      });

      await prisma.item.update({
        where: { id: itemId },
        data: itemUpdateData
      });
    }

    // Get updated item
    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        reactions: {
          where: { userId }
        }
      }
    });

    const userReaction = updatedItem.reactions[0] || null;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        item: {
          ...updatedItem,
          uid: updatedItem.uid.toString(),
          reactions: undefined // Don't send reactions array
        },
        userReaction: userReaction ? {
          liked: userReaction.liked,
          disliked: userReaction.disliked,
          heatedUp: userReaction.heatedUp
        } : null
      })
    };
  } catch (error) {
    console.error('React item error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
