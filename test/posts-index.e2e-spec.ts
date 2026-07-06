import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { PostsController } from '../src/posts/posts.controller';
import { PostsService } from '../src/posts/posts.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('PostsController (e2e)', () => {
  let app: INestApplication;

  const mockPosts: any[] = [];
  for (let i = 1; i <= 15; i++) {
    mockPosts.push({
      title: `Post Title ${i}`,
      content: `Content of post ${i} NestJS`,
      excerpt: `Excerpt ${i}`,
      slug: `post-title-${i}`,
      status: i <= 10 ? 'publish' : 'draft',
      author_id: i % 2 === 0 ? 2 : 1,
      published_at: i <= 10 ? new Date() : null,
      created_at: new Date(Date.now() - i * 1000), // Ensures predictable sorting
    });
  }

  const mockPostsService = {
    findAll: jest.fn().mockImplementation((query) => {
      let items = [...mockPosts];
      const page = query.page ? parseInt(query.page) : 1;
      const per_page = query.per_page ? parseInt(query.per_page) : 10;
      const status = query.status || 'publish';
      
      items = items.filter(p => p.status === status);
      
      if (query.author) {
        items = items.filter(p => p.author_id === parseInt(query.author));
      }
      
      if (query.search) {
        const s = query.search.toLowerCase();
        items = items.filter(p => p.title.toLowerCase().includes(s) || p.content.toLowerCase().includes(s));
      }
      
      const orderby = query.orderby || 'created_at';
      const order = query.order ? query.order.toLowerCase() : 'desc';
      
      items.sort((a, b) => {
        if (a[orderby] < b[orderby]) return order === 'asc' ? -1 : 1;
        if (a[orderby] > b[orderby]) return order === 'asc' ? 1 : -1;
        return 0;
      });
      
      const total = items.length;
      const skip = (page - 1) * per_page;
      items = items.slice(skip, skip + per_page);
      
      return {
        data: items,
        meta: {
          total,
          pages: Math.ceil(total / per_page),
          current_page: page,
          per_page,
        }
      };
    })
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new HttpExceptionFilter());
    
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) => {
          const details: Record<string, string> = {};
          errors.forEach((err) => {
            if (err.constraints) {
              details[err.property] = Object.values(err.constraints)[0];
            }
          });
          return new BadRequestException({
            error: "Bad Request",
            message: "Validation failed",
            details,
          });
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('TC-01: Default listing (no params)', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(10);
    expect(response.body.meta.total).toBe(10);
    expect(response.body.meta.current_page).toBe(1);
    expect(response.body.meta.per_page).toBe(10);
  });

  it('TC-08: Sad Path Negative page number', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?page=-1');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.details.page).toBeDefined();
  });

  it('TC-11: Sad Path Invalid status enum', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?status=archived');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.details.status).toBeDefined();
  });
  it('TC-02: Valid custom pagination', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?page=2&per_page=5');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(5);
    expect(response.body.meta.current_page).toBe(2);
    expect(response.body.meta.per_page).toBe(5);
  });

  it('TC-03: Filter by valid status', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?status=draft');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(5);
    expect(response.body.meta.total).toBe(5);
  });

  it('TC-04: Filter by valid author', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?author=2');
    expect(response.status).toBe(200);
    expect(response.body.data.every((post: any) => post.author_id === 2)).toBe(true);
  });

  it('TC-05: Valid text search', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?search=NestJS');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(10);
  });

  it('TC-06: Valid custom sorting', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?orderby=title&order=asc');
    expect(response.status).toBe(200);
    const firstTitle = response.body.data[0].title;
    const secondTitle = response.body.data[1].title;
    expect(firstTitle < secondTitle || firstTitle === secondTitle).toBe(true);
  });

  it('TC-07: Combined valid parameters', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?status=publish&author=1&page=1');
    expect(response.status).toBe(200);
    expect(response.body.data.every((post: any) => post.status === 'publish' && post.author_id === 1)).toBe(true);
  });

  it('TC-09: Pagination exceeds max limit', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?per_page=105');
    expect(response.status).toBe(400);
    expect(response.body.details.per_page).toBeDefined();
  });

  it('TC-10: Pagination zero boundary', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?per_page=0');
    expect(response.status).toBe(400);
    expect(response.body.details.per_page).toBeDefined();
  });

  it('TC-12: Invalid orderby attribute', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?orderby=password');
    expect(response.status).toBe(400);
    expect(response.body.details.orderby).toBeDefined();
  });

  it('TC-13: Invalid order direction', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?order=diagonal');
    expect(response.status).toBe(400);
    expect(response.body.details.order).toBeDefined();
  });

  it('TC-14: Wrong data type (String instead of Int)', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?author=abc');
    expect(response.status).toBe(400);
    expect(response.body.details.author).toBeDefined();
  });

  it('TC-15: Wrong data type (Float instead of Int)', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?page=1.5');
    expect(response.status).toBe(400);
    expect(response.body.details.page).toBeDefined();
  });

  it('TC-16: Search string exceeds max length', async () => {
    const longString = 'a'.repeat(101);
    const response = await request(app.getHttpServer()).get(`/api/posts?search=${longString}`);
    expect(response.status).toBe(400);
    expect(response.body.details.search).toBeDefined();
  });

  it('TC-17: Empty string values', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?status=&author=');
    expect(response.status).toBe(400);
    expect(response.body.details.status || response.body.details.author).toBeDefined();
  });

  it('TC-18: Valid parameters, no results', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?search=NonExistentWord');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(0);
    expect(response.body.meta.total).toBe(0);
  });
});
