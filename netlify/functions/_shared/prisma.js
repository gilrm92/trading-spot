const { PrismaClient } = require('@prisma/client');

// Hardcoded database URL - always use this value
process.env.DATABASE_URL = 'postgres://6305e14dbb95f6bef6388277bec34f2fe0fe5fae760e09f9e92001fea108a2ba:sk_BBvvaIYQ2Nc3-MKNFgDiW@db.prisma.io:5432/postgres?sslmode=require';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
