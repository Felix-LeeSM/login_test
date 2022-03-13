import { CompleteFirstLoginDTO } from './dto/completeFirstLogin.dto';
import { payload } from './type/jwt.type';
import { Users } from './entity/users.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginType } from './enum/enums';
import { v1 } from 'uuid';
import bcrypt from 'bcrypt';
import { access } from 'fs';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Users)
    private userRepository: Repository<Users>,
  ) {}
  SECRET_KEY = this.configService.get<string>('MY_SECRET_KEY');
  HASH_SALT = this.configService.get<string>('HASH_SALT');

  async getKakaoToken(code: string, res: Response) {
    const clientId = this.configService.get<string>('KAKAO_REST_API_KEY');
    const redirectURL = this.configService.get<string>('KAKAO_REDIRECT_URL');
    const grantType = 'authorization_code';
    const URL = `https://kauth.kakao.com/oauth/token`;
    let accessToken: string;

    try {
      const result = await axios({
        method: 'POST',
        url: URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        params: {
          code,
          grant_type: grantType,
          client_id: clientId,
          redirect_uri: redirectURL,
        },
      });
      accessToken = result.data.access_token;
    } catch (err) {
      throw new HttpException(
        `error: ${err.response.data.error}, errorDescription: ${err.response.data.error_description}`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.getUserInfoByToken(accessToken, LoginType['kakao'], res);
  }

  async getGoogleToken(code: string, res: Response): Promise<any> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientPassword = this.configService.get<string>(
      'GOOGLE_CLIENT_PASSWORD',
    );
    const redirectURL = this.configService.get<string>('GOOGLE_REDIRECT_URL');
    const URL = 'https://oauth2.googleapis.com/token';
    let accessToken = '';
    let idToken: string;

    try {
      const result = await axios({
        method: 'POST',
        url: URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        params: {
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientPassword,
          redirect_uri: redirectURL,
        },
      });
      accessToken = result.data.access_token;
      idToken = result.data.id_token;
    } catch (err) {
      throw new HttpException(
        `error: ${err.response.data.error}, errorDescription: ${err.response.data.error_description}`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.getUserInfoByToken(
      accessToken,
      LoginType['google'],
      res,
      idToken,
    );
  }

  async getGithubToken(code: string, res: Response) {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientPassword = this.configService.get<string>(
      'GITHUB_CLIENT_PASSWORD',
    );
    const URL = `https://github.com/login/oauth/access_token`;
    let accessToken: string;

    try {
      const result = await axios({
        method: 'POST',
        url: URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          Accept: 'application/json',
        },
        params: {
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientPassword,
        },
      });
      accessToken = result.data.access_token;
    } catch (err) {
      throw new HttpException(
        `error: ${err.response.data.error}, errorDescription: ${err.response.data.error_description}`,
        HttpStatus.UNAUTHORIZED,
      );
      return;
    }

    return this.getUserInfoByToken(accessToken, LoginType['github'], res);
  }

  async getUserInfoByToken(
    accessToken: string,
    site: number,
    res: Response,
    idToken?: string,
  ) {
    let id: string;
    let existUser: Users | undefined;
    try {
      if (site === LoginType['kakao']) {
        const userInfo = await axios({
          method: 'GET',
          url: `https://kapi.kakao.com/v1/user/access_token_info`,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        id = userInfo.data.id.toString();
        //
        //
      } else if (site === LoginType['google']) {
        const userInfo = await axios({
          method: 'GET',
          url: `https://oauth2.googleapis.com/tokeninfo`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
          params: {
            id_token: `${idToken}`,
          },
        });
        id = userInfo.data.sub; // << 유저의 고유값
        //
        //
      } else if (site === LoginType['github']) {
        const userInfo = await axios({
          method: 'GET',
          url: 'https://api.github.com/user',
          headers: {
            Authorization: `token ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            Accept: 'application/json',
          },
        });
        console.log(userInfo.data);
        id = userInfo.data.id.toString();
      } else {
        throw new HttpException(
          'error: Bad Request, errorDescription: 잘못된 요청입니다.',
          HttpStatus.BAD_REQUEST,
        );
      }
      console.log(id);
      id = await bcrypt.hash(id, this.HASH_SALT);
      console.log('hashed ID', id);
      existUser = await this.userRepository.findOne({
        where: {
          loginType: site,
          indigenousKey: id,
        },
      });
    } catch (err) {
      console.log(err);
      throw new HttpException(
        `소셜 로그인 요청 에러, error: ${err}`,
        HttpStatus.UNAUTHORIZED,
      );
      return;
    }
    return this.internalTokenCreation(existUser, id, site, res);
  }

  async internalTokenCreation(
    existUser: Users | undefined,
    id: string,
    site: number,
    res: Response,
  ) {
    const redirectToFront = this.configService.get<string>('FRONT_SERVER');
    let accessToken: string;
    let payload: jwt.JwtPayload;
    if (existUser && existUser.nickname) {
      // 다회차 고인물
      payload = { sub: existUser.userId };
      const accessToken = jwt.sign(payload, this.SECRET_KEY, {
        expiresIn: '10h',
      });
      const refreshToken = jwt.sign(
        { sub: existUser.userId },
        this.SECRET_KEY,
        {
          expiresIn: '24h',
        },
      );
      existUser.refreshToken = refreshToken;
      await this.userRepository.save(existUser);
      console.log(payload);
      return res.redirect(
        `${redirectToFront}accessToken=${accessToken}&refreshToken=${refreshToken}`,
      );
    } else if (existUser) {
      payload = { sub: existUser.userId };
      accessToken = jwt.sign(payload, this.SECRET_KEY, {
        expiresIn: '10h',
      });
    } else {
      const userId = v1();
      const newUser = this.userRepository.create();
      newUser.userId = userId;
      newUser.loginType = site;
      newUser.indigenousKey = id;
      await this.userRepository.save(newUser);
      payload = { sub: userId };
      accessToken = jwt.sign(payload, this.SECRET_KEY, {
        expiresIn: '10h',
      });
    }
    return res.redirect(`${redirectToFront}accessToken=${accessToken}`);
  }

  async userValidation(accessToken: string, refreshToken: string) {
    console.log('여기도 와써용');
    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(accessToken, this.SECRET_KEY);
      console.log('259번째 줄 verified', verified);
      if (typeof verified === 'string') {
        throw new Error();
        return;
      }
      payload = verified;
    } catch {
      console.log('refreshToken 있냐');
      console.log('refreshToken', refreshToken);
      if (refreshToken) {
        try {
          // refresh 토큰을 기반으로 DB에서 찾고, accessToken을 새로 발급해줌.
          const userId = jwt.decode(accessToken).sub;
          const existUser = await this.userRepository.findOne({
            select: ['nickname', 'profileImgUrl'],
            where: {
              userId,
              refreshToken,
            },
          });
          if (existUser) {
            console.log('refreshToken 괜찮네');
            console.log('리프레시 토큰으로 existUser:', existUser);
            const novelAccessToken = jwt.sign(
              { sub: userId },
              this.SECRET_KEY,
              {
                expiresIn: '10h',
              },
            );

            return {
              success: true,
              data: {
                userInfo: existUser,
                authorization: `Bearer ${novelAccessToken}`,
              },
            };
          }
        } catch (err) {}
      }
      throw new HttpException(`다시 로그인 해주세요`, HttpStatus.UNAUTHORIZED);
    }
    console.log('페이로드 따써용');
    const userId = payload.sub;
    const existUser = await this.userRepository.findOne({
      where: {
        userId,
      },
      select: ['nickname', 'profileImgUrl'],
    });
    console.log('existUser 게또');
    console.log(payload);
    console.log(existUser, '설마 닉네임 프로필이 없어서?');
    if (existUser && existUser.nickname) {
      console.log('이건 안 들어갈거야');
      const accessToken = jwt.sign({ sub: userId }, this.SECRET_KEY, {
        expiresIn: '10h',
      });
      return {
        success: true,
        data: {
          userInfo: existUser,
          authorization: `Bearer ${accessToken}`,
        },
      };
    } else if (existUser) {
      console.log('대신에 여기로 들어가겠지?');
      const accessToken = jwt.sign({ sub: userId }, this.SECRET_KEY, {
        expiresIn: '10h',
      });
      return {
        success: true,
        data: {
          userInfo: existUser,
          authorization: `Bearer ${accessToken}`,
        },
      };
    }
    console.log('이건 유저가 아예 없을 때니까 에러가 나는 거야!');
    throw new HttpException('잘못된 요청입니다.', HttpStatus.UNAUTHORIZED);
  }

  async completeFirstLogin(token, body: CompleteFirstLoginDTO) {
    let userId: string;
    try {
      const verified = jwt.verify(token, this.SECRET_KEY);
      if (typeof verified === 'string') {
        throw new HttpException(
          'Unprocessable Entity',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const payload: jwt.JwtPayload = verified;
      userId = payload.sub;
    } catch (err) {
      throw new HttpException(`${err}`, HttpStatus.BAD_REQUEST);
    }
    const intermediateUser = await this.userRepository.findOne({
      where: {
        userId,
      },
    });

    const payload: payload = { sub: body.userId };
    const accessToken = jwt.sign(payload, this.SECRET_KEY, {
      expiresIn: '10h',
    });

    for (const element in body) {
      intermediateUser[element] = body[element];
    }
    const refreshToken = jwt.sign(
      { sub: intermediateUser.userId },
      this.SECRET_KEY,
      {
        expiresIn: '24h',
      },
    );
    intermediateUser.refreshToken = refreshToken;
    await this.userRepository.save(intermediateUser);

    return {
      authorization: `Bearer ${accessToken}`,
      refreshToken: `Bearer ${refreshToken}`,
    };
  }
}
