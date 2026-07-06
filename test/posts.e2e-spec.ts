import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { Repository } from 'typeorm';
import { Post } from './../src/posts/entities/post.entity';
import { User } from './../src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';

describe('PostsController (e2e)', () => {
  let app: INestApplication;
  let postRepository: Repository<Post>;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  let authorToken: string;
  let otherToken: string;
  let authorId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    postRepository = moduleFixture.get<Repository<Post>>(getRepositoryToken(Post));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Setup users
    await userRepository.clear();
    await postRepository.clear();

    const author = await userRepository.save({
      email: 'author@example.com',
      password_hash: 'hash',
      name: 'Author',
    });
    authorId = author.id;
    authorToken = jwtService.sign({ sub: author.id, email: author.email });

    const other = await userRepository.save({
      email: 'other@example.com',
      password_hash: 'hash',
      name: 'Other',
    });
    otherToken = jwtService.sign({ sub: other.id, email: other.email });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await postRepository.clear();
  });

  it('/api/posts/:id (GET) - Publish (Anonymous)', async () => {
    const post = await postRepository.save({
      title: 'Title',
      slug: 'slug-pub',
      status: 'publish',
      author_id: authorId,
    });
    const response = await request(app.getHttpServer()).get(`/api/posts/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('deleted_at');
  });

  it('/api/posts/:id (GET) - Draft (Author)', async () => {
    const post = await postRepository.save({
      title: 'Title',
      slug: 'slug-draft-auth',
      status: 'draft',
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
  });

  it('/api/posts/:id (GET) - Draft (Other)', async () => {
    const post = await postRepository.save({
      title: 'Title',
      slug: 'slug-draft-oth',
      status: 'draft',
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(response.status).toBe(403);
  });

  it('/api/posts/:id (GET) - Trash (Returns 404)', async () => {
    const post = await postRepository.save({
      title: 'Title',
      slug: 'slug-trash',
      status: 'trash',
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(404);
  });

  it('/api/posts/:id/trash (GET) - Trash (Author)', async () => {
    const post = await postRepository.save({
      title: 'Title',
      slug: 'slug-trash-auth',
      status: 'trash',
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}/trash`)
      .set('Authorization', `Bearer ${authorToken}`);
    expect(response.status).toBe(200);
  });
});
