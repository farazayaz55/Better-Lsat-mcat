import { Injectable } from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { BaseAclService } from '../../shared/acl/acl.service';
import { Action } from '../../shared/acl/action.constant';
import { IActor } from '../../shared/acl/actor.constant';
import { Article } from '../entities/article.entity';

@Injectable()
export class ArticleAclService extends BaseAclService<Article> {
  constructor() {
    super();
    this.canDo(ROLE.ADMIN, [Action.MANAGE]);
    this.canDo(ROLE.USER, [Action.CREATE, Action.LIST, Action.READ]);
    this.canDo(ROLE.USER, [Action.UPDATE, Action.DELETE], this.isArticleAuthor);
  }

  isArticleAuthor(article: Article, user: IActor): boolean {
    return article.author?.id === user.id;
  }
}
