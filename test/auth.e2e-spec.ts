import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { Repository } from 'typeorm';
import { User } from './../src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
  });

  beforeEach(async () => {
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/auth/register (POST) - Success', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe('test@example.com');
    expect(response.body).not.toHaveProperty('password_hash');
  });

  it('/api/auth/register (POST) - Duplicate Email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });
    
    expect(response.status).toBe(409);
  });

  it('/api/auth/login (POST) - Success', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
  });

  it('/api/auth/login (POST) - Invalid Password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });
    
    expect(response.status).toBe(401);
  });
});
