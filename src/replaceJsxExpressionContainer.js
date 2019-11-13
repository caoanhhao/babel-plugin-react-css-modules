// @flow

import BabelTypes, {
  binaryExpression,
  Identifier,
  isJSXExpressionContainer,
  isStringLiteral,
  jSXAttribute,
  JSXAttribute,
  jSXExpressionContainer,
  jSXIdentifier
} from '@babel/types';
import type {
  GetClassNameOptionsType
} from './types';
import conditionalClassMerge from './conditionalClassMerge';
import createObjectExpression from './createObjectExpression';
import optionsDefaults from './schemas/optionsDefaults';

export default (
  t: BabelTypes,
  // eslint-disable-next-line flowtype/no-weak-types
  path: Object,
  sourceAttribute: JSXAttribute,
  destinationName: string,
  importedHelperIndentifier: Identifier,
  styleModuleImportMapIdentifier: Identifier,
  options: GetClassNameOptionsType
): void => {
  const expressionContainerValue = sourceAttribute.value;
  const destinationAttribute = path.node.openingElement.attributes
    .find((attribute) => {
      return typeof attribute.name !== 'undefined' && attribute.name.name === destinationName;
    });

  if (destinationAttribute) {
    path.node.openingElement.attributes.splice(path.node.openingElement.attributes.indexOf(destinationAttribute), 1);
  }

  path.node.openingElement.attributes.splice(path.node.openingElement.attributes.indexOf(sourceAttribute), 1);

  const args = [
    expressionContainerValue.expression,
    styleModuleImportMapIdentifier
  ];

  // Only provide options argument if the options are something other than default
  // This helps save a few bits in the generated user code
  if (options.handleMissingStyleName !== optionsDefaults.handleMissingStyleName ||
    options.autoResolveMultipleImports !== optionsDefaults.autoResolveMultipleImports) {
    args.push(createObjectExpression(t, options));
  }

  let styleNameExpression
  function customGetClassName(expression) {
    switch (expression.type) {
      case 'MemberExpression':
        let property = expression.property.name ? expression.property.name : expression.property.value
        return t.memberExpression(
          t.memberExpression(
            styleModuleImportMapIdentifier,
            t.identifier(expression.object.name)
          ),
          t.identifier(property))
      case 'StringLiteral':
        return expression
      case 'Identifier':
        return expression
      case 'ConditionalExpression':
        return expression
      case 'TemplateLiteral':
        for (let is = 0; is < expression.expressions.length; is++) {
          expression.expressions[is] = customGetClassName(expression.expressions[is])
        }
        return expression
      default:
        console.log(expression.type)
        return t.callExpression(t.clone(importedHelperIndentifier), args)
    }
  }
  if (sourceAttribute.name.name === 'className') {
    styleNameExpression = customGetClassName(expressionContainerValue.expression)
  } else {
    styleNameExpression = t.callExpression(t.clone(importedHelperIndentifier), args)
  }

  if (destinationAttribute) {
    if (isStringLiteral(destinationAttribute.value)) {
      path.node.openingElement.attributes.push(jSXAttribute(
        jSXIdentifier(destinationName),
        jSXExpressionContainer(
          binaryExpression(
            '+',
            t.stringLiteral(destinationAttribute.value.value + ' '),
            styleNameExpression
          )
        )
      ));
    } else if (isJSXExpressionContainer(destinationAttribute.value)) {
      path.node.openingElement.attributes.push(jSXAttribute(
        jSXIdentifier(destinationName),
        jSXExpressionContainer(
          conditionalClassMerge(
            destinationAttribute.value.expression,
            styleNameExpression
          )
        )
      ));
    } else {
      throw new Error('Unexpected attribute value: ' + destinationAttribute.value);
    }
  } else {
    path.node.openingElement.attributes.push(jSXAttribute(
      jSXIdentifier(destinationName),
      jSXExpressionContainer(
        styleNameExpression
      )
    ));
  }
};
