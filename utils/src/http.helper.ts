import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  GoneException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  MethodNotAllowedException,
  MisdirectedException,
  NotAcceptableException,
  NotFoundException,
  NotImplementedException,
  PayloadTooLargeException,
  PreconditionFailedException,
  RequestTimeoutException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { HttpStatusCode } from 'axios';

export const HttpStatusCodes = {
  ...HttpStatus,
  ...HttpStatusCode,
};

export type HttpStatusCodes =
  (typeof HttpStatusCodes)[keyof typeof HttpStatusCodes];

const httpStatusDescriptions: {
  [key in HttpStatusCodes]?: string;
} = {
  [HttpStatus.CONTINUE]: '100: Request received, server awaiting further info.',
  [HttpStatus.SWITCHING_PROTOCOLS]:
    '101: Client asked server to switch protocols.',
  [HttpStatus.PROCESSING]: '102: Server processing request, no response yet.',
  [HttpStatus.OK]: '200: Request successful and response provided.',
  [HttpStatus.CREATED]: '201: Request completed, and resource created.',
  [HttpStatus.ACCEPTED]: '202: Request accepted but processing not complete.',
  [HttpStatus.NON_AUTHORITATIVE_INFORMATION]:
    '203: Info from another source returned.',
  [HttpStatus.NO_CONTENT]: '204: Request succeeded with no content to send.',
  [HttpStatus.RESET_CONTENT]: '205: Client should reset document view.',
  [HttpStatus.PARTIAL_CONTENT]:
    '206: Partial resource returned due to range header.',
  // [HttpStatus.MULTI_STATUS]: '207: Multiple status responses for request.',
  // [HttpStatus.ALREADY_REPORTED]:
  //   '208: Resource state already sent in earlier request.',
  // [HttpStatus.IM_USED]: '226: Request fulfilled and resource modified.',
  // [HttpStatus.MULTIPLE_CHOICES]: '300: Multiple options for the resource.',
  [HttpStatus.MOVED_PERMANENTLY]: '301: Resource moved permanently.',
  [HttpStatus.FOUND]: '302: Resource temporarily moved, use given URI.',
  [HttpStatus.SEE_OTHER]: '303: Response found elsewhere, use GET for that.',
  [HttpStatus.NOT_MODIFIED]: '304: Resource not modified since last request.',
  // [HttpStatus.USE_PROXY]: '305: Must access resource via specified proxy.',
  [HttpStatus.TEMPORARY_REDIRECT]:
    '307: Resource temporarily moved, but use same method.',
  [HttpStatus.PERMANENT_REDIRECT]:
    '308: Resource moved permanently, use same method.',
  [HttpStatus.BAD_REQUEST]:
    "400: Server couldn't understand request due to invalid syntax.",
  [HttpStatus.UNAUTHORIZED]: '401: Authentication needed for request.',
  [HttpStatus.PAYMENT_REQUIRED]: '402: Payment required for this resource.',
  [HttpStatus.FORBIDDEN]: '403: Server understood but refuses to authorize.',
  [HttpStatus.NOT_FOUND]: "404: Server can't find the requested resource.",
  [HttpStatus.METHOD_NOT_ALLOWED]: '405: HTTP method not allowed for resource.',
  [HttpStatus.NOT_ACCEPTABLE]: "406: Resource doesn't match criteria.",
  [HttpStatus.PROXY_AUTHENTICATION_REQUIRED]:
    '407: Proxy authentication required.',
  [HttpStatus.REQUEST_TIMEOUT]: '408: Server timed out waiting for request.',
  [HttpStatus.CONFLICT]: '409: Request conflict with server state.',
  [HttpStatus.GONE]: '410: Resource requested is no longer available.',
  [HttpStatus.LENGTH_REQUIRED]: '411: Length of request not specified.',
  [HttpStatus.PRECONDITION_FAILED]: '412: Precondition for request not met.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: '413: Request payload too large.',
  [HttpStatus.URI_TOO_LONG]: '414: URI requested is too long.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: '415: Media type not supported.',
  [HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE]:
    '416: Range specified is invalid.',
  [HttpStatus.EXPECTATION_FAILED]:
    "417: Server can't meet request expectation.",
  [HttpStatus.I_AM_A_TEAPOT]: "418: I'm a teapot (April Fools joke).",
  // [HttpStatus.MISDIRECTED_REQUEST]:
  //   "421: Request misdirected, can't produce response.",
  [HttpStatus.UNPROCESSABLE_ENTITY]:
    '422: Request understandable, but semantically wrong.',
  // [HttpStatus.LOCKED]: "423: Resource you're accessing is locked.",
  [HttpStatus.FAILED_DEPENDENCY]:
    "424: Request failed due to server's previous request.",
  // [HttpStatus.TOO_EARLY]: '425: Request might be replayed.',
  // [HttpStatus.UPGRADE_REQUIRED]:
  //   '426: Client should switch to another protocol.',
  [HttpStatus.PRECONDITION_REQUIRED]: '428: Precondition required for request.',
  [HttpStatus.TOO_MANY_REQUESTS]: '429: Too many requests from this client.',
  // [HttpStatus.REQUEST_HEADER_FIELDS_TOO_LARGE]: '431: Headers too long.',
  [HttpStatusCode.UnavailableForLegalReasons]:
    '451: Unavailable due to legal reasons.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    "500: Server faced an error and can't provide response.",
  [HttpStatus.NOT_IMPLEMENTED]:
    "501: Server doesn't support functionality needed.",
  [HttpStatus.BAD_GATEWAY]:
    '502: Server got invalid response from upstream server.',
  [HttpStatus.SERVICE_UNAVAILABLE]: '503: Server not ready to handle request.',
  [HttpStatus.GATEWAY_TIMEOUT]:
    "504: Server didn't get response from another server.",
  [HttpStatus.HTTP_VERSION_NOT_SUPPORTED]:
    "505: Server doesn't support HTTP protocol version.",
  // [HttpStatus.VARIANT_ALSO_NEGOTIATES]:
  //   '506: Server has internal configuration error.',
  // [HttpStatus.INSUFFICIENT_STORAGE]:
  //   "507: Server can't store the representation.",
  // [HttpStatus.LOOP_DETECTED]:
  //   '508: Server detected an infinite loop while processing.',
  // [HttpStatus.NOT_EXTENDED]: '510: Further extensions needed for request.',
  // [HttpStatus.NETWORK_AUTHENTICATION_REQUIRED]:
  //   '511: Client needs to authenticate for network access.',
};

export const getHttpStatusDescription = (
  status: HttpStatusCodes,
  fallbackDescription = 'Unknown status code',
): string => {
  return httpStatusDescriptions[status] ?? fallbackDescription;
};

export const httpExceptionStatusCodes = {
  [BadRequestException.name]: HttpStatus.BAD_REQUEST,
  [UnauthorizedException.name]: HttpStatus.UNAUTHORIZED,
  [ForbiddenException.name]: HttpStatus.FORBIDDEN,
  [NotFoundException.name]: HttpStatus.NOT_FOUND,
  [MethodNotAllowedException.name]: HttpStatus.METHOD_NOT_ALLOWED,
  [NotAcceptableException.name]: HttpStatus.NOT_ACCEPTABLE,
  [RequestTimeoutException.name]: HttpStatus.REQUEST_TIMEOUT,
  [ConflictException.name]: HttpStatus.CONFLICT,
  [GoneException.name]: HttpStatus.GONE,
  [PreconditionFailedException.name]: HttpStatus.PRECONDITION_FAILED,
  [PayloadTooLargeException.name]: HttpStatus.PAYLOAD_TOO_LARGE,
  [UnsupportedMediaTypeException.name]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [UnprocessableEntityException.name]: HttpStatus.UNPROCESSABLE_ENTITY,
  [InternalServerErrorException.name]: HttpStatus.INTERNAL_SERVER_ERROR,
  [NotImplementedException.name]: HttpStatus.NOT_IMPLEMENTED,
  [BadGatewayException.name]: HttpStatus.BAD_GATEWAY,
  [ServiceUnavailableException.name]: HttpStatus.SERVICE_UNAVAILABLE,
  [GatewayTimeoutException.name]: HttpStatus.GATEWAY_TIMEOUT,
  [HttpException.name]: HttpStatus.INTERNAL_SERVER_ERROR,
  [MisdirectedException.name]: HttpStatus.MISDIRECTED,
};
