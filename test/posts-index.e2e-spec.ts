import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Post } from '../src/posts/entities/post.entity';
import { User } from '../src/users/entities/user.entity';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { JwtService } from '@nestjs/jwt';

describe('PostsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let user1Token: string;
  let user2Token: string;
  let user1Id: number;
  let user2Id: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
    
    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await dataSource.synchronize(true);

    const userRepo = dataSource.getRepository(User);
    const user1 = await userRepo.save({
      email: 'user1@example.com',
      password_hash: 'hash',
      name: 'User 1',
    });
    user1Id = user1.id;
    user1Token = jwtService.sign({ sub: user1.id, email: user1.email });

    const user2 = await userRepo.save({
      email: 'user2@example.com',
      password_hash: 'hash',
      name: 'User 2',
    });
    user2Id = user2.id;
    user2Token = jwtService.sign({ sub: user2.id, email: user2.email });

    const postRepo = dataSource.getRepository(Post);
    // Seed 15 posts
    const postsToInsert = [];
    for (let i = 1; i <= 15; i++) {
      postsToInsert.push({
        title: `Post Title ${i}`,
        content: `Content of post ${i} NestJS`,
        excerpt: `Excerpt ${i}`,
        slug: `post-title-${i}`,
        status: i <= 10 ? 'publish' : 'draft',
        author_id: i % 2 === 0 ? user2Id : user1Id,
        published_at: i <= 10 ? new Date() : null,
      });
    }
    // Seed 1 legacy draft post (author_id = null)
    postsToInsert.push({
      title: `Legacy Draft Post`,
      content: `Content of legacy draft NestJS`,
      excerpt: `Legacy Excerpt`,
      slug: `legacy-draft-post`,
      status: 'draft',
      author_id: null,
      published_at: null,
    });
    // Seed 1 trash post for user1
    postsToInsert.push({
      title: `User 1 Trash Post`,
      content: `Content of user 1 trash NestJS`,
      excerpt: `Trash Excerpt`,
      slug: `user-1-trash-post`,
      status: 'trash',
      author_id: user1Id,
      published_at: null,
      deleted_at: new Date(),
    });
    // Seed 1 trash post for user2
    postsToInsert.push({
      title: `User 2 Trash Post`,
      content: `Content of user 2 trash NestJS`,
      excerpt: `Trash Excerpt`,
      slug: `user-2-trash-post`,
      status: 'trash',
      author_id: user2Id,
      published_at: null,
      deleted_at: new Date(),
    });
    // Seed 1 legacy trash post (author_id = null)
    postsToInsert.push({
      title: `Legacy Trash Post`,
      content: `Content of legacy trash NestJS`,
      excerpt: `Legacy Trash Excerpt`,
      slug: `legacy-trash-post`,
      status: 'trash',
      author_id: null,
      published_at: null,
      deleted_at: new Date(),
    });

    await postRepo.save(postsToInsert);
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

  it('TC-03: Filter by valid status (authenticated)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/posts?status=draft')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(200);
    // User 1 has 3 drafts of their own + 1 legacy draft = 4 posts
    expect(response.body.data.length).toBe(4);
    expect(response.body.meta.total).toBe(4);
  });

  it('TC-04: Filter by valid author', async () => {
    const response = await request(app.getHttpServer()).get(`/api/posts?author=${user2Id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.every((post: any) => post.author_id === user2Id)).toBe(true);
  });

  it('TC-05: Valid text search', async () => {
    const response = await request(app.getHttpServer()).get('/api/posts?search=NestJS');
    expect(response.status).toBe(200);
    // 10 published posts match "NestJS" in content. Let's make sure length is 10.
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
    const response = await request(app.getHttpServer()).get(`/api/posts?status=publish&author=${user1Id}&page=1`);
    expect(response.status).toBe(200);
    expect(response.body.data.every((post: any) => post.status === 'publish' && post.author_id === user1Id)).toBe(true);
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

  // ─── Spec 1-1 Auth Test Cases ──────────────────────────────────────────

  it('TC-19: Happy Path - View own draft posts', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/posts?status=draft')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.every((post: any) => post.status === 'draft' && (post.author_id === user1Id || post.author_id === null))).toBe(true);
  });

  it('TC-20: Happy Path - View own draft posts with explicit author matching ID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/posts?status=draft&author=${user1Id}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.every((post: any) => post.status === 'draft' && (post.author_id === user1Id || post.author_id === null))).toBe(true);
  });

  it('TC-21: Sad Path - View drafts anonymously (no token)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/posts?status=draft');
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  it('TC-22: Sad Path - View other author\'s drafts', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/posts?status=draft&author=${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
    expect(response.body.message).toContain('unpublished');
  });

  it('TC-23: Happy Path - View own trashed posts', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/posts?status=trash')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(200);
    // User 1 has 1 trashed post of their own + 1 legacy trash post = 2 posts
    expect(response.body.data.length).toBe(2);
    expect(response.body.data.every((post: any) => post.status === 'trash' && (post.author_id === user1Id || post.author_id === null))).toBe(true);
  });

  it('TC-24: Sad Path - View other author\'s trashed posts', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/posts?status=trash&author=${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });

  it('TC-25: Happy Path - Legacy posts visibility (draft)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/posts?status=draft')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(response.status).toBe(200);
    const legacyDraft = response.body.data.find((p: any) => p.author_id === null);
    expect(legacyDraft).toBeDefined();
    expect(legacyDraft.slug).toBe('legacy-draft-post');
  });
});
