import { Test, TestingModule } from '@nestjs/testing';
import { UserBlockStatusMiddleware, CorsMiddleware } from '../src/middlewares';
import * as jwt from 'jsonwebtoken';

// Mock Redis client
const mockRedisClient = {
  get: jest.fn()
};

// Test JWT secret
const TEST_JWT_SECRET = 'test-secret-key';

describe('Middleware Tests', () => {
  let userBlockMiddleware: UserBlockStatusMiddleware;
  let corsMiddleware: CorsMiddleware;

  beforeEach(async () => {
    userBlockMiddleware = new UserBlockStatusMiddleware({
      redisClient: mockRedisClient,
      jwtSecret: TEST_JWT_SECRET
    });
    corsMiddleware = new CorsMiddleware();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('UserBlockStatusMiddleware', () => {
    it('should allow request when no authorization header is present', () => {
      const req = { headers: {} } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      userBlockMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow request when JWT token has no company_id', () => {
      // Create properly signed JWT with no company_id
      const mockJWT = jwt.sign({ user_id: 123 }, TEST_JWT_SECRET);
      
      const req = { 
        headers: { 
          authorization: `Bearer ${mockJWT}` 
        } 
      } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      userBlockMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block request when Redis data contains is_blocked: true', (done) => {
      // Create properly signed JWT with company_id
      const mockJWT = jwt.sign({ company_id: 'company123' }, TEST_JWT_SECRET);
      
      const req = { 
        headers: { 
          authorization: `Bearer ${mockJWT}` 
        } 
      } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      // Mock Redis response with blocked user
      mockRedisClient.get.mockImplementation((key, callback) => {
        expect(key).toBe('USER_BLOCK_STATUS_company123');
        callback(null, JSON.stringify({ is_blocked: true, block_reason: 'Account suspended' }));
      });

      userBlockMiddleware.use(req, res, next);

      // Since Redis is async, we need to wait
      setTimeout(() => {
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Forbidden',
          message: 'User is blocked',
          timestamp: expect.any(String),
          company_id: 'company123'
        });
        expect(next).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should allow request when Redis data does not contain is_blocked: true', (done) => {
      // Create properly signed JWT with company_id
      const mockJWT = jwt.sign({ company_id: 'company123' }, TEST_JWT_SECRET);
      
      const req = { 
        headers: { 
          authorization: `Bearer ${mockJWT}` 
        } 
      } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      // Mock Redis response with non-blocked user
      mockRedisClient.get.mockImplementation((key, callback) => {
        expect(key).toBe('USER_BLOCK_STATUS_company123');
        callback(null, JSON.stringify({ is_blocked: false }));
      });

      userBlockMiddleware.use(req, res, next);

      // Since Redis is async, we need to wait
      setTimeout(() => {
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should allow request when Redis returns no data', (done) => {
      // Create properly signed JWT with company_id
      const mockJWT = jwt.sign({ company_id: 'company123' }, TEST_JWT_SECRET);
      
      const req = { 
        headers: { 
          authorization: `Bearer ${mockJWT}` 
        } 
      } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      // Mock Redis response with no data
      mockRedisClient.get.mockImplementation((key, callback) => {
        expect(key).toBe('USER_BLOCK_STATUS_company123');
        callback(null, null);
      });

      userBlockMiddleware.use(req, res, next);

      // Since Redis is async, we need to wait
      setTimeout(() => {
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle invalid JWT tokens gracefully', () => {
      // Invalid JWT token
      const invalidJWT = 'invalid.jwt.token';
      
      const req = { 
        headers: { 
          authorization: `Bearer ${invalidJWT}` 
        } 
      } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      userBlockMiddleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('CorsMiddleware', () => {
    it('should add CORS headers for regular requests', () => {
      const req = { method: 'GET', headers: {} } as any;
      const res = { header: jest.fn() } as any;
      const next = jest.fn();

      corsMiddleware.use(req, res, next);

      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(next).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight requests', () => {
      const req = { method: 'OPTIONS', headers: {} } as any;
      const res = { 
        header: jest.fn().mockReturnThis(), 
        status: jest.fn().mockReturnThis(),
        end: jest.fn()
      } as any;
      const next = jest.fn();

      corsMiddleware.use(req, res, next);

      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
}); 